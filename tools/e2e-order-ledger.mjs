#!/usr/bin/env node
// order:out 账本写路径验证（阶段2「就近履约」）
// 完整链路：Shop 匿名下单 → ArrangingPayment → createPayment → admin settlePayment
//   → admin createFulfillment → transitionFulfillmentToState(Pending)（触发 Sale 扣库）
//   → stockLedger(bizCode=订单号) 断言存在 order:out 流水，qty/location 与下单一致。
// 用法:
//   node tools/e2e-order-ledger.mjs http://127.0.0.1:3000/shop-api http://127.0.0.1:3000/admin-api
// 退出码: 0=通过  1=失败
const SHOP = process.argv[2] || "http://127.0.0.1:3000/shop-api";
const ADMIN = process.argv[3] || "http://127.0.0.1:3000/admin-api";
const CHANNEL_TOKEN = "abc123xyz";
const CITY = "长春市";
const ORDER_LOC = { lat: 43.8256, lng: 125.3235 };

let failures = 0;
function check(name, ok, detail) {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

async function shopGql(query, variables = {}, token = "") {
  const headers = { "Content-Type": "application/json", "vendure-channel-token": CHANNEL_TOKEN };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(SHOP, { method: "POST", headers, body: JSON.stringify({ query, variables }) });
  const body = await res.json().catch(() => ({ http: res.status, raw: "parse-fail" }));
  const h = res.headers.get("vendure-auth-token");
  if (h && body.data) body.data.__sessionToken = h;
  if (body.errors) console.log("[shop-err]", body.errors.map(e => e.message).join(" | "));
  return body;
}
async function adminGql(query, variables = {}, token = "") {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(ADMIN, { method: "POST", headers, body: JSON.stringify({ query, variables }) });
  const body = await res.json().catch(() => ({ http: res.status, raw: "parse-fail" }));
  const h = res.headers.get("vendure-auth-token");
  if (h && body.data) body.data.__authToken = h;
  if (body.errors) console.log("[admin-err]", body.errors.map(e => e.message).join(" | "));
  return body;
}
async function adminLogin() {
  const attempts = [
    ["superadmin", "superadmin"],
    ["superadmin@china.test", "superadmin"],
    ["superadmin", "admin123"],
    ["superadmin@china.test", "admin123"],
  ];
  for (const [u, p] of attempts) {
    const r = await adminGql(`mutation{login(username:"${u}",password:"${p}"){... on CurrentUser{identifier}... on InvalidCredentialsError{message}}}`);
    if (r.data?.__authToken) return r.data.__authToken;
  }
  throw new Error("Admin 登录失败");
}

(async () => {
  const adminToken = await adminLogin();
  console.log("[admin] LOGIN_OK");

  // 0. 找有货商品（经 variantNearbyStock 取最近仓有库存的 variant）
  const list = await shopGql(`query($opts: ProductListOptions){ products(options:$opts){ totalItems items { id name variants { id sku name } } } }`, { opts: { take: 50 } });
  const items = list.data?.products?.items || [];
  let chosen = null;
  for (const p of items) {
    for (const v of p.variants || []) {
      const near = await shopGql(
        `query($pid: ID!, $vid: ID, $lat: Float, $lng: Float, $city: String){ variantNearbyStock(productId: $pid, variantId: $vid, lat: $lat, lng: $lng, city: $city){ distanceKm location { id name } variants { stockOnHand stockAvailable } } }`,
        { pid: p.id, vid: v.id, lat: ORDER_LOC.lat, lng: ORDER_LOC.lng, city: CITY },
      );
      const rows = near.data?.variantNearbyStock || [];
      const row = rows.find(x => x.variants?.[0]?.stockAvailable > 0);
      if (row) { chosen = { productId: p.id, variantId: v.id, sku: v.sku, name: `${p.name}/${v.name}`, locationId: row.location.id, locationName: row.location.name, qty: 1 }; break; }
    }
    if (chosen) break;
  }
  if (!chosen) throw new Error("无有货商品（可先建仓/入库再跑本脚本）");
  console.log(`[shop] 选用有货商品: ${chosen.name} (sku=${chosen.sku}) @${chosen.locationName}#${chosen.locationId}`);

  // 1. 匿名会话下单
  let token = "";
  const active0 = await shopGql(`query { activeOrder { id code state } }`);
  token = active0.data?.__sessionToken || "";

  let r = await shopGql(`mutation($id: ID!, $q: Int!){ addItemToOrder(productVariantId: $id, quantity: $q){ ... on Order { id code state totalWithTax } ... on ErrorResult { message } } }`, { id: chosen.variantId, q: chosen.qty }, token);
  token = r.data?.__sessionToken || token;
  if (r.data?.addItemToOrder?.__typename === "ErrorResult") throw new Error("加购失败: " + JSON.stringify(r.data?.addItemToOrder));
  const orderCode = r.data?.addItemToOrder?.code;
  let orderId = r.data?.addItemToOrder?.id;
  check("下单加购", !!orderCode, `code=${orderCode}`);

  r = await shopGql(`mutation{ setOrderShippingAddress(input: { fullName: "账本验证", streetLine1: "朝阳区自由大路 100 号", city: "${CITY}", countryCode: "CN" }){ ... on Order { id state } ... on ErrorResult { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  r = await shopGql(`mutation{ setCustomerForOrder(input: { emailAddress: "ledger-e2e@example.com", firstName: "账本", lastName: "验证" }){ ... on Order { id state } ... on ErrorResult { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  r = await shopGql(`query { eligibleShippingMethods { id code name } }`, {}, token);
  token = r.data?.__sessionToken || token;
  const shipMethods = r.data?.eligibleShippingMethods || [];
  if (!shipMethods.length) throw new Error("无可用配送方式");
  r = await shopGql(`mutation($id: ID!){ setOrderShippingMethod(shippingMethodId: [$id]){ ... on Order { id state } ... on ErrorResult { message } } }`, { id: shipMethods[0].id }, token);
  token = r.data?.__sessionToken || token;
  r = await shopGql(`mutation{ transitionOrderToState(state: "ArrangingPayment"){ ... on Order { id code state } ... on OrderStateTransitionError { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  orderId = r.data?.transitionOrderToState?.id || orderId;
  check("转入 ArrangingPayment", r.data?.transitionOrderToState?.state === "ArrangingPayment", JSON.stringify(r.data?.transitionOrderToState || {}));

  // 2. addPaymentToOrder → PaymentAuthorized（Vendure 3.x Shop API）
  r = await shopGql(`query { eligiblePaymentMethods { id code name } }`, {}, token);
  token = r.data?.__sessionToken || token;
  const payMethods = r.data?.eligiblePaymentMethods || [];
  if (!payMethods.length) throw new Error("无可用支付方式（请先在后台配置 dummy-payment 支付方式）");
  r = await shopGql(`mutation($code: String!){ addPaymentToOrder(input: { method: $code, metadata: {} }){ ... on Order { id state payments { id state } } ... on ErrorResult { message } } }`, { code: payMethods[0].code }, token);
  token = r.data?.__sessionToken || token;
  const orderAfterPay = r.data?.addPaymentToOrder;
  const paymentId = orderAfterPay?.payments?.[0]?.id;
  check("addPaymentToOrder → PaymentAuthorized", orderAfterPay?.state === "PaymentAuthorized" && !!paymentId, `state=${orderAfterPay?.state} payId=${paymentId}`);

  // 3. Admin: settlePayment → Settled（Vendure 3.x Payment 状态枚举为 Settled）
  r = await adminGql(`mutation($id: ID!){ settlePayment(id: $id){ ... on Payment { id state } ... on SettlePaymentError { errorCode message } } }`, { id: paymentId }, adminToken);
  const settled = r.data?.settlePayment;
  check("settlePayment → Settled", settled?.state === "Settled", JSON.stringify(settled || {}));

  // 4. Admin: addFulfillmentToOrder（创建即 Pending，Created→Pending 触发 Sale → order:out 账本）
  const od = await adminGql(`query($id: ID!){ order(id: $id){ id code lines { id quantity } } }`, { id: orderId }, adminToken);
  const orderLines = od.data?.order?.lines || [];
  const lineInput = orderLines.map(l => ({ orderLineId: l.id, quantity: l.quantity }));
  r = await adminGql(
    `mutation($input: FulfillOrderInput!){ addFulfillmentToOrder(input: $input){ ... on Fulfillment { id state } ... on ErrorResult { message } } }`,
    { input: { lines: lineInput, handler: { code: "manual-fulfillment", arguments: [{ name: "method", value: "标准快递" }] } } },
    adminToken,
  );
  const fulfillment = r.data?.addFulfillmentToOrder;
  if (fulfillment?.__typename === "ErrorResult") throw new Error("addFulfillmentToOrder 失败: " + JSON.stringify(fulfillment));
  check("addFulfillmentToOrder → Pending（触发扣库）", !!fulfillment?.id && fulfillment?.state === "Pending", `state=${fulfillment?.state}`);

  // 5. 断言 order:out 账本
  const lg = await adminGql(`query($bc: String!){ stockLedger(bizCode: $bc, pageSize: 50){ totalItems items { code bizType bizCode direction quantity orderLineId stockLocationId beforeOnHand afterOnHand reason createdAt } } }`, { bc: orderCode }, adminToken);
  const entries = lg.data?.stockLedger?.items || [];
  const out = entries.find(e => e.bizType === "order" && e.direction === "out");
  check("stockLedger(order:out) 存在", !!out, out ? `${out.code} qty=${out.quantity} @loc#${out.stockLocationId} ${out.reason}` : `entries=${entries.length}`);

  // 6. 交叉核对：qty 一致 + 发货仓是就近命中仓
  check("order:out 数量与下单一致", !!out && out.quantity === chosen.qty, out ? `期望 ${chosen.qty}` : "");
  check("order:out 发货仓=就近仓", !!out && String(out.stockLocationId) === String(chosen.locationId), out ? `期望 #${chosen.locationId}(${chosen.locationName})` : "");
  if (out) console.log(`[ledger] 快照 onHand ${out.beforeOnHand} → ${out.afterOnHand}`);

  console.log(`\n== 结果: ${failures === 0 ? "全部通过" : failures + " 项失败"} ==`);
  console.log(`订单 ${orderCode} (id=${orderId}), Fulfillment ${fulfillment?.id}, Payment ${paymentId}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.log("ERR:", e.message); process.exit(1); });
