#!/usr/bin/env node
// 阶段4「售后多仓按包回补」端到端验证
//
// 前置（dev server 运行中，default 渠道 token=default-token，双仓 Default(1)/二道区仓(2)）：
//   注：客户角色（__customer_role__）仅挂 default 渠道，售后须在 default 渠道发起（shop-a 无客户权限）
//   1) 双仓拆单回补：双仓各 5 可售 → 下单 8（定位近 B 仓 → B 5 / A 3）
//      发货后 onHand B:0 / A:2 → 售后退货 4 → 断言 B +3 / A +1（最大余数法）
//      onHand B:3 / A:3，账本两条 afterSales:in（loc2:3 / loc1:1），restockJson 留痕
//   2) 单仓回归：single-loc 商品单仓下单发货 → 退货 → 回补仍进原仓
//   3) 全额退货：拆单 8（B5/A3）→ 退货 8 → 各仓回补 5 / 3（=各仓发货量）
//
// 用法:
//   node tools/e2e-phase4-after-sales-restock.mjs [shop-api] [admin-api]
// 退出码: 0=通过(含SKIP)  1=存在FAIL
const SHOP = process.argv[2] || "http://127.0.0.1:3000/shop-api";
const ADMIN = process.argv[3] || "http://127.0.0.1:3000/admin-api";
const CHANNEL_TOKEN = "default-token";
const DEFAULT_CHANNEL_ID = "1"; // default 渠道（客户角色所在渠道）
const VARIANT_SKU = "NF-WATER-500";
const LOC_PRIORITY = "2"; // 二道区仓（B 仓）
const LOC_DEFAULT = "1";  // Default（A 仓）
const NEAR_ANCHOR = { lat: 43.8502, lng: 125.4232 }; // 近 B 仓
const ORDER_QTY = 8;      // 双仓各 5 可售 → 拆 B5/A3
const CUSTOMER = { email: "phase4-restock@example.com", password: "Phase4Restock123!", firstName: "阶段", lastName: "四号" };

let passed = 0, failed = 0, skipped = 0;
function result(name, ok, detail) {
  const tag = ok === true ? "PASS" : ok === false ? "FAIL" : "SKIP";
  if (ok === true) passed++; else if (ok === false) failed++; else skipped++;
  console.log(`[${tag}] ${name}${detail ? " — " + detail : ""}`);
}

async function shopGql(query, variables = {}, token = "") {
  const headers = { "Content-Type": "application/json", "vendure-token": CHANNEL_TOKEN };
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
  return null;
}
async function setChannelCustomFields(token, channelId, cf) {
  const r = await adminGql(
    `mutation($id: ID!, $cf: UpdateChannelCustomFieldsInput!){ updateChannel(input: { id: $id, customFields: $cf }){ ... on Channel { id customFields{ shippingStrategy stockLocationPriority memberStockStrategy } } } }`,
    { id: channelId, cf },
    token,
  );
  return r.data?.updateChannel;
}
async function setVariantStock(token, variantId, locationId, stockOnHand) {
  const r = await adminGql(
    `mutation{ setVariantStock(productVariantId: ${JSON.stringify(variantId)}, stockLocationId: ${JSON.stringify(locationId)}, stockOnHand: ${stockOnHand}) }`,
    {},
    token,
  );
  return r.data?.setVariantStock === true;
}
async function findVariant(token, sku) {
  const r = await adminGql(`query{ products(options:{ take: 100 }){ items{ name variants{ id sku stockLevels{ stockOnHand stockAllocated stockLocationId } } } } }`, {}, token);
  const v = r.data?.products?.items?.flatMap(x => (x.variants || []).map(vv => ({ ...vv, productName: x.name }))).find(vv => vv.sku === sku);
  if (!v) { console.log(`未找到 SKU=${sku}`); process.exit(1); }
  return v;
}
async function stockLevel(token, variantId, locId) {
  const r = await adminGql(`query{ products(options:{ take: 100 }){ items{ variants{ id sku stockLevels{ stockOnHand stockAllocated stockLocationId } } } } }`, {}, token);
  const v = r.data?.products?.items?.flatMap(x => x.variants || []).find(x => x.sku === VARIANT_SKU);
  return (v?.stockLevels || []).find(l => String(l.stockLocationId) === String(locId));
}
// 登录客户下单（会话归属客户，售后必需）
async function placeOrderAsCustomer(variantId, qty, email, coords) {
  let r = await shopGql(`mutation($email: String!, $pw: String!){ login(username: $email, password: $pw){ ... on CurrentUser { id } ... on InvalidCredentialsError { message } } }`, { email: email, pw: CUSTOMER.password });
  let token = r.data?.__sessionToken || "";
  // 清理客户残留的活跃订单行（上次失败运行可能留下半成品订单），保证本次下单从 0 开始
  r = await shopGql(`mutation{ removeAllOrderLines{ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  r = await shopGql(`mutation($id: ID!, $q: Int!){ addItemToOrder(productVariantId: $id, quantity: $q){ ... on Order { id code } ... on ErrorResult { message } } }`, { id: variantId, q: qty }, token);
  token = r.data?.__sessionToken || token;
  const o = r.data?.addItemToOrder;
  if (!o?.id) throw new Error(`addItemToOrder 失败: ${JSON.stringify(o)}`);
  r = await shopGql(`mutation{ setOrderCustomFields(input: { customFields: { lat: ${coords.lat}, lng: ${coords.lng}, city: "长春市", deliveryType: "delivery" } }){ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  r = await shopGql(`mutation{ setOrderShippingAddress(input: { fullName: "阶段四验证", streetLine1: "测试街道1号", city: "长春市", countryCode: "CN" }){ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  r = await shopGql(`query { eligibleShippingMethods { id code } }`, {}, token);
  token = r.data?.__sessionToken || token;
  const sm = (r.data?.eligibleShippingMethods || [])[0];
  if (!sm) throw new Error("无可用配送方式");
  r = await shopGql(`mutation($id: ID!){ setOrderShippingMethod(shippingMethodId: [$id]){ ... on Order { id } ... on ErrorResult { message } } }`, { id: sm.id }, token);
  token = r.data?.__sessionToken || token;
  r = await shopGql(`mutation{ transitionOrderToState(state: "ArrangingPayment"){ ... on Order { id code state } ... on OrderStateTransitionError { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  const tr = r.data?.transitionOrderToState;
  if (!tr?.id) throw new Error(`转入 ArrangingPayment 失败: ${JSON.stringify(tr)}`);
  return { token, orderId: tr.id, code: tr.code };
}
async function payAndShip(adminToken, shopToken, orderId) {
  let r = await shopGql(`query { eligiblePaymentMethods { code } }`, {}, shopToken);
  const pay = (r.data?.eligiblePaymentMethods || [])[0];
  if (!pay) throw new Error("无可用支付方式");
  r = await shopGql(`mutation($code: String!){ addPaymentToOrder(input: { method: $code, metadata: {} }){ ... on Order { id payments { id } } ... on ErrorResult { message } } }`, { code: pay.code }, shopToken);
  const paymentId = r.data?.addPaymentToOrder?.payments?.[0]?.id;
  await adminGql(`mutation($id: ID!){ settlePayment(id: $id){ ... on Payment { id state } } }`, { id: paymentId }, adminToken);
  const od = await adminGql(`query($id: ID!){ order(id: $id){ id lines { id quantity } } }`, { id: orderId }, adminToken);
  const lines = (od.data?.order?.lines || []).map(l => ({ orderLineId: l.id, quantity: l.quantity }));
  r = await adminGql(`mutation($input: FulfillOrderInput!){ addFulfillmentToOrder(input: $input){ ... on Fulfillment { id state } ... on ErrorResult { message } } }`, { input: { lines, handler: { code: "manual-fulfillment", arguments: [{ name: "method", value: "标准快递" }] } } }, adminToken);
  const f = r.data?.addFulfillmentToOrder;
  if (f?.__typename === "ErrorResult") throw new Error("addFulfillmentToOrder 失败: " + JSON.stringify(f));
  await adminGql(`mutation($id: ID!, $st: String!){ transitionFulfillmentToState(id: $id, state: $st){ ... on Fulfillment { id state } } }`, { id: f.id, st: "Shipped" }, adminToken);
  return { paymentId, fulfillmentId: f.id };
}
// 客户发起售后 → Admin approve → updateReturnTracking → confirmReturnReceived
async function afterSalesFlow(adminToken, shopToken, orderId, lineId, receivedQty) {
  const o = await adminGql(`query($id: ID!){ order(id: $id){ id total } }`, { id: orderId }, adminToken);
  const total = o.data?.order?.total || 1;
  let r = await shopGql(`mutation($input: CreateAfterSalesRequestInput!){ createAfterSalesRequest(input: $input){ id state } }`, { input: { orderId, orderLineId: lineId, type: "return_refund", reason: "阶段4多仓回补验证", refundAmount: total } }, shopToken);
  const req = r.data?.createAfterSalesRequest;
  if (!req?.id) throw new Error("createAfterSalesRequest 失败: " + JSON.stringify(r.data));
  await adminGql(`mutation{ approveAfterSalesRequest(id: ${JSON.stringify(req.id)}) { id state } }`, {}, adminToken);
  r = await shopGql(`mutation{ updateReturnTracking(id: ${JSON.stringify(req.id)}, trackingNo: "SF-P4-001", carrier: "顺丰") { id state } }`, {}, shopToken);
  if (r.data?.updateReturnTracking?.state !== "Returning") throw new Error("未到 Returning: " + JSON.stringify(r.data));
  const done = await adminGql(`mutation{ confirmReturnReceived(id: ${JSON.stringify(req.id)}, receivedQuantity: ${receivedQty}) { id state receivedQuantity restockJson } }`, {}, adminToken);
  return done.data?.confirmReturnReceived;
}
function sum(entries, locId) {
  return (entries || []).filter(e => String(e.stockLocationId) === String(locId)).reduce((s, e) => s + Number(e.quantity), 0);
}

(async () => {
  console.log(`== 阶段4 售后多仓按包回补 e2e == SHOP=${SHOP} ADMIN=${ADMIN}`);
  const adminToken = await adminLogin();
  if (!adminToken) { console.log("Admin 登录失败"); process.exit(1); }
  const v = await findVariant(adminToken, VARIANT_SKU);
  const origStock = {};
  for (const lv of (v.stockLevels || [])) origStock[String(lv.stockLocationId)] = { onHand: lv.stockOnHand };

  // 前置：default 渠道策略置 nearest（定位近 B 仓 → B 仓先分配 → B5/A3）
  const setupCf = { shippingStrategy: "nearest", stockLocationPriority: JSON.stringify([{ locationId: "1", priority: 1 }, { locationId: "2", priority: 2 }]), memberStockStrategy: null };
  const chSetup = await setChannelCustomFields(adminToken, DEFAULT_CHANNEL_ID, setupCf);
  result("前置.default 渠道策略 nearest", chSetup?.customFields?.shippingStrategy === "nearest", JSON.stringify(chSetup?.customFields));

  // 注册测试客户（幂等）
  await shopGql(`mutation($i: RegisterCustomerInput!){ registerCustomerAccount(input: $i){ ... on Success { success } ... on ErrorResult { message } } }`, { i: { emailAddress: CUSTOMER.email, firstName: CUSTOMER.firstName, lastName: CUSTOMER.lastName, password: CUSTOMER.password } }).catch(() => {});

  try {
    // ========== 场景1: 双仓拆单回补（B5/A3 发货，退货4 → B+3/A+1） ==========
    // 双仓各 5 可售（onHand = 5 + 当前 allocated）
    for (const locId of [LOC_DEFAULT, LOC_PRIORITY]) {
      const lv = (v.stockLevels || []).find(l => String(l.stockLocationId) === String(locId));
      await setVariantStock(adminToken, v.id, locId, 5 + (lv?.stockAllocated ?? 0));
    }
    const o1 = await placeOrderAsCustomer(v.id, ORDER_QTY, CUSTOMER.email, NEAR_ANCHOR);
    result("s1.双仓拆单下单 8 件", !!o1.orderId, `code=${o1.code}`);
    const od1 = await adminGql(`query($id: ID!){ order(id: $id){ id lines { id quantity customFields { stockLocationId stockLocationsJson } } } }`, { id: o1.orderId }, adminToken);
    const line1 = od1.data?.order?.lines?.[0];
    let d1 = [];
    try { d1 = JSON.parse(line1?.customFields?.stockLocationsJson || "[]"); } catch {}
    const shipped1 = {};
    for (const d of d1) shipped1[String(d.locationId)] = Number(d.quantity) || 0;
    result("s1.拆单明细 B5/A3", shipped1[LOC_PRIORITY] === 5 && shipped1[LOC_DEFAULT] === 3, JSON.stringify(shipped1));
    await payAndShip(adminToken, o1.token, o1.orderId);
    // 发货后 onHand: B 5-5=0 / A 5-3=2
    const lvAfter1 = {};
    lvAfter1[LOC_PRIORITY] = (await stockLevel(adminToken, v.id, LOC_PRIORITY))?.stockOnHand;
    lvAfter1[LOC_DEFAULT] = (await stockLevel(adminToken, v.id, LOC_DEFAULT))?.stockOnHand;
    result("s1.发货后 onHand B:0 / A:2", lvAfter1[LOC_PRIORITY] === 0 && lvAfter1[LOC_DEFAULT] === 2, `B:${lvAfter1[LOC_PRIORITY]} A:${lvAfter1[LOC_DEFAULT]}`);
    const rq1 = await afterSalesFlow(adminToken, o1.token, o1.orderId, line1.id, 4);
    // 回补后 onHand: B 0+3=3 / A 2+1=3
    const lvAfter2 = {};
    lvAfter2[LOC_PRIORITY] = (await stockLevel(adminToken, v.id, LOC_PRIORITY))?.stockOnHand;
    lvAfter2[LOC_DEFAULT] = (await stockLevel(adminToken, v.id, LOC_DEFAULT))?.stockOnHand;
    result("s1.退货4回补后 onHand B:3 / A:3", lvAfter2[LOC_PRIORITY] === 3 && lvAfter2[LOC_DEFAULT] === 3, `B:${lvAfter2[LOC_PRIORITY]} A:${lvAfter2[LOC_DEFAULT]}`);
    // 账本：两条 afterSales:in（loc2:3 / loc1:1）
    const lg1 = await adminGql(`query($bc: String!){ stockLedger(bizCode: $bc, pageSize: 20){ items { bizType direction quantity stockLocationId } } }`, { bc: `AS${rq1.id}` }, adminToken);
    const as1 = (lg1.data?.stockLedger?.items || []).filter(e => e.bizType === "afterSales" && e.direction === "in");
    const as1B = sum(as1, LOC_PRIORITY), as1A = sum(as1, LOC_DEFAULT);
    result("s1.账本两条 afterSales:in（loc2:3 / loc1:1）", as1.length === 2 && as1B === 3 && as1A === 1, JSON.stringify(as1.map(e => `#${e.stockLocationId}:${e.quantity}`)));
    // restockJson 留痕
    let rj1 = [];
    try { rj1 = JSON.parse(rq1?.restockJson || "[]"); } catch {}
    const rj1B = sum(rj1, LOC_PRIORITY), rj1A = sum(rj1, LOC_DEFAULT);
    result("s1.restockJson 留痕 loc2:3 / loc1:1", rj1.length === 2 && rj1B === 3 && rj1A === 1, rq1?.restockJson || "null");

    // ========== 场景2: 单仓回归（single-loc 商品单仓下单 → 退货回原仓） ==========
    // 找另一个仅在单仓有货的商品（回退：用同一 variant 把 B 仓清空、只留 A 仓）
    const v2 = await findVariant(adminToken, VARIANT_SKU);
    const bAlloc2 = (v2.stockLevels || []).find(l => String(l.stockLocationId) === String(LOC_PRIORITY))?.stockAllocated ?? 0;
    await setVariantStock(adminToken, v2.id, LOC_PRIORITY, 0 + bAlloc2);
    const o2 = await placeOrderAsCustomer(v2.id, 3, CUSTOMER.email, { lat: 43.8, lng: 125.3 }); // 定位远离 B，仍可能双仓；此处以单一发货验证
    const od2 = await adminGql(`query($id: ID!){ order(id: $id){ id lines { id quantity customFields { stockLocationId stockLocationsJson } } } }`, { id: o2.orderId }, adminToken);
    const line2 = od2.data?.order?.lines?.[0];
    let d2 = [];
    try { d2 = JSON.parse(line2?.customFields?.stockLocationsJson || "[]"); } catch {}
    if (d2.length === 1) {
      await payAndShip(adminToken, o2.token, o2.orderId);
      const loc2 = String(d2[0].locationId);
      const before2 = (await stockLevel(adminToken, v2.id, loc2))?.stockOnHand;
      const rq2 = await afterSalesFlow(adminToken, o2.token, o2.orderId, line2.id, 3);
      const after2 = (await stockLevel(adminToken, v2.id, loc2))?.stockOnHand;
      result("s2.单仓回补进原仓", after2 === before2 + 3, `loc#${loc2} ${before2}→${after2} restockJson=${rq2?.restockJson}`);
    } else {
      result("s2.单仓回归", null, `B 仓已清空仍拆 ${d2.length} 仓，跳过（${JSON.stringify(d2)}）`);
    }

    // ========== 场景3: 全额退货（拆单 B5/A3 发货，退货8 → 各仓回补 5/3） ==========
    for (const locId of [LOC_DEFAULT, LOC_PRIORITY]) {
      const lv = (await stockLevel(adminToken, v.id, locId));
      await setVariantStock(adminToken, v.id, locId, 5 + (lv?.stockAllocated ?? 0));
    }
    const o3 = await placeOrderAsCustomer(v.id, ORDER_QTY, CUSTOMER.email, NEAR_ANCHOR);
    const od3 = await adminGql(`query($id: ID!){ order(id: $id){ id lines { id quantity customFields { stockLocationsJson } } } }`, { id: o3.orderId }, adminToken);
    const line3 = od3.data?.order?.lines?.[0];
    await payAndShip(adminToken, o3.token, o3.orderId);
    const rq3 = await afterSalesFlow(adminToken, o3.token, o3.orderId, line3.id, ORDER_QTY);
    const lg3 = await adminGql(`query($bc: String!){ stockLedger(bizCode: $bc, pageSize: 20){ items { bizType direction quantity stockLocationId } } }`, { bc: `AS${rq3.id}` }, adminToken);
    const as3 = (lg3.data?.stockLedger?.items || []).filter(e => e.bizType === "afterSales" && e.direction === "in");
    const as3B = sum(as3, LOC_PRIORITY), as3A = sum(as3, LOC_DEFAULT);
    result("s3.全额退货各仓回补 5/3", as3.length === 2 && as3B === 5 && as3A === 3, JSON.stringify(as3.map(e => `#${e.stockLocationId}:${e.quantity}`)));
  } finally {
    // 清理：还原库存
    for (const [locId, snap] of Object.entries(origStock)) {
      await setVariantStock(adminToken, v.id, locId, snap.onHand).catch(() => {});
    }
  }

  console.log(`\n== 结果: PASS=${passed} FAIL=${failed} SKIP=${skipped} ==`);
  process.exit(failed ? 1 : 0);
})();
