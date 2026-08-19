#!/usr/bin/env node
// 阶段2「就近履约」数据准备脚本：为 e2e-phase2.mjs 完整回归造齐三类业务数据
//   1) 移库     : 建第二仓库 + setVariantStock 建库存 → createStockMoveOrder → ship → receive → complete
//   2) 售后退货 : 注册/登录客户 → 下单发货(Shipped) → createAfterSalesRequest → approve
//                 → updateReturnTracking(Returning) → confirmReturnReceived(Received, 触发库存回补)
//   3) 自提核销 : 建自提点 → 匿名下单 setOrderPickupLocation → 支付发货(Shipped) → confirmPickupHandover
// 用法:
//   node tools/seed-phase2-data.mjs http://127.0.0.1:3000/shop-api http://127.0.0.1:3000/admin-api
// 幂等: 重复运行会创建新订单/售后/移库（e2e 扫描全量数据）；不会对同一订单行重复建售后。
const SHOP = process.argv[2] || "http://127.0.0.1:3000/shop-api";
const ADMIN = process.argv[3] || "http://127.0.0.1:3000/admin-api";
const CHANNEL_TOKEN = "abc123xyz";
const CITY = "长春市";
const COORDS = { lat: 43.8256, lng: 125.3235 }; // 长春市区（与 Default Stock Location 一致）

// 测试客户（注册后登录，售后订单归属校验用）
const CUSTOMER = { email: "phase2-seed@example.com", password: "Phase2Seed123!", firstName: "阶段", lastName: "二号" };

let log = (m) => console.log("[seed]", m);

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

// ---- 下单通用流程：加购 → 定位字段 → 地址/客户 → 配送 → ArrangingPayment → 支付 → settle → 发货(Shipped)
// 返回 { shopToken, orderId, orderCode, paymentId, fulfillmentId, lineId, variantId }
// sessionToken: 传入则用该已登录会话下单（订单归属该客户，售后必需）；缺省匿名会话
async function placeAndShipOrder(adminToken, { variantId, quantity = 1, pickupLocationId = null, city = CITY, coords = COORDS, sessionToken = "", email = "" } = {}) {
  let token = sessionToken;
  if (!token) {
    const active0 = await shopGql(`query { activeOrder { id code state } }`);
    token = active0.data?.__sessionToken || "";
  }

  let r = await shopGql(`mutation($id: ID!, $q: Int!){ addItemToOrder(productVariantId: $id, quantity: $q){ ... on Order { id code state totalWithTax lines { id quantity } } ... on ErrorResult { message } } }`, { id: variantId, q: quantity }, token);
  token = r.data?.__sessionToken || token;
  const order0 = r.data?.addItemToOrder;
  if (order0?.__typename === "ErrorResult") throw new Error("加购失败: " + JSON.stringify(order0));
  const lineId = order0?.lines?.[0]?.id;
  let orderId = order0?.id;
  let orderCode = order0?.code;

  if (pickupLocationId) {
    // 自提：选点（内部落库 deliveryType='pickup' + 同步自提点地址）
    r = await shopGql(`mutation($lid: ID!, $pt: String!){ setOrderPickupLocation(pickupLocationId: $lid, pickupType: $pt){ id state } }`, { lid: pickupLocationId, pt: "store" }, token);
    token = r.data?.__sessionToken || token;
  } else {
    // 上门：写订单定位自定义字段 + 收货地址
    r = await shopGql(`mutation{ setOrderCustomFields(input: { customFields: { lat: ${coords.lat}, lng: ${coords.lng}, city: "${city}", deliveryType: "delivery" } }){ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
    token = r.data?.__sessionToken || token;
    r = await shopGql(`mutation{ setOrderShippingAddress(input: { fullName: "阶段二测试", streetLine1: "朝阳区自由大路 100 号", city: "${city}", countryCode: "CN" }){ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
    token = r.data?.__sessionToken || token;
  }

  // 匿名订单用唯一邮箱避免与已注册客户冲突（EmailAddressConflictError）
  const orderEmail = email || CUSTOMER.email;
  r = await shopGql(`mutation{ setCustomerForOrder(input: { emailAddress: "${orderEmail}", firstName: "${CUSTOMER.firstName}", lastName: "${CUSTOMER.lastName}" }){ ... on Order { id state } ... on ErrorResult { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;

  r = await shopGql(`query { eligibleShippingMethods { id code name } }`, {}, token);
  token = r.data?.__sessionToken || token;
  const methods = r.data?.eligibleShippingMethods || [];
  if (!methods.length) throw new Error("无可用配送方式");
  r = await shopGql(`mutation($id: ID!){ setOrderShippingMethod(shippingMethodId: [$id]){ ... on Order { id state } ... on ErrorResult { message } } }`, { id: methods[0].id }, token);
  token = r.data?.__sessionToken || token;

  r = await shopGql(`mutation{ transitionOrderToState(state: "ArrangingPayment"){ ... on Order { id code state } ... on OrderStateTransitionError { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  orderId = r.data?.transitionOrderToState?.id || orderId;
  orderCode = r.data?.transitionOrderToState?.code || orderCode;

  // 支付
  r = await shopGql(`query { eligiblePaymentMethods { code } }`, {}, token);
  token = r.data?.__sessionToken || token;
  const pay = r.data?.eligiblePaymentMethods || [];
  if (!pay.length) throw new Error("无可用支付方式");
  r = await shopGql(`mutation($code: String!){ addPaymentToOrder(input: { method: $code, metadata: {} }){ ... on Order { id state payments { id state } } ... on ErrorResult { message } } }`, { code: pay[0].code }, token);
  token = r.data?.__sessionToken || token;
  const paymentId = r.data?.addPaymentToOrder?.payments?.[0]?.id;

  r = await adminGql(`mutation($id: ID!){ settlePayment(id: $id){ ... on Payment { id state } ... on SettlePaymentError { message } } }`, { id: paymentId }, adminToken);

  // 发货：addFulfillmentToOrder（创建即 Pending 触发扣库）→ transition Shipped（售后前置条件）
  const od = await adminGql(`query($id: ID!){ order(id: $id){ id code lines { id quantity } } }`, { id: orderId }, adminToken);
  const lineInput = (od.data?.order?.lines || []).map(l => ({ orderLineId: l.id, quantity: l.quantity }));
  r = await adminGql(`mutation($input: FulfillOrderInput!){ addFulfillmentToOrder(input: $input){ ... on Fulfillment { id state } ... on ErrorResult { message } } }`, { input: { lines: lineInput, handler: { code: "manual-fulfillment", arguments: [{ name: "method", value: "标准快递" }] } } }, adminToken);
  const fulfillment = r.data?.addFulfillmentToOrder;
  if (fulfillment?.__typename === "ErrorResult") throw new Error("addFulfillmentToOrder 失败: " + JSON.stringify(fulfillment));
  r = await adminGql(`mutation($id: ID!, $st: String!){ transitionFulfillmentToState(id: $id, state: $st){ ... on Fulfillment { id state } ... on FulfillmentStateTransitionError { message } } }`, { id: fulfillment.id, st: "Shipped" }, adminToken);

  return { shopToken: token, orderId, orderCode, paymentId, fulfillmentId: fulfillment.id, lineId, variantId, quantity };
}

// ============ 1) 移库：第二仓库 + 建库存 + 走单 ============
async function seedStockMove(adminToken, variantId) {
  // 幂等：查已有同名仓
  const q = await adminGql(`query { stockLocations { totalItems items { id name } } }`, {}, adminToken);
  const locs = q.data?.stockLocations?.items || [];
  let loc2 = locs.find(l => l.name === "二道区仓");
  if (!loc2) {
    const c = await adminGql(`mutation{ createStockLocation(input: { name: "二道区仓", description: "阶段2测试第二仓", customFields: { lat: 43.8502, lng: 125.4232, serviceCities: ["长春市"] } }){ id name } }`, {}, adminToken);
    loc2 = c.data?.createStockLocation;
    if (!loc2) throw new Error("createStockLocation 失败: " + JSON.stringify(c.data));
    // 二仓建库存
    await adminGql(`mutation{ setVariantStock(productVariantId: ${JSON.stringify(variantId)}, stockLocationId: ${JSON.stringify(loc2.id)}, stockOnHand: 50) }`, {}, adminToken);
    log(`建第二仓 #${loc2.id} 二道区仓 + 库存 50`);
  } else {
    log(`复用第二仓 #${loc2.id} 二道区仓`);
  }

  // 源仓取第一个仓
  const loc1 = locs.find(l => l.name !== "二道区仓");
  if (!loc1) throw new Error("找不到源仓");

  const m = await adminGql(`mutation($input: CreateStockMoveOrderInput!){ createStockMoveOrder(input: $input){ id code state sourceLocationId targetLocationId } }`, { input: { sourceLocationId: loc1.id, targetLocationId: loc2.id, lines: [{ productVariantId: variantId, quantity: 3 }] } }, adminToken);
  const move = m.data?.createStockMoveOrder;
  if (!move) throw new Error("createStockMoveOrder 失败: " + JSON.stringify(m.data));
  await adminGql(`mutation{ shipStockMoveOrder(id: ${JSON.stringify(move.id)}) { id state } }`, {}, adminToken);
  await adminGql(`mutation{ receiveStockMoveOrder(id: ${JSON.stringify(move.id)}) { id state } }`, {}, adminToken);
  const done = await adminGql(`mutation{ completeStockMoveOrder(id: ${JSON.stringify(move.id)}) { id state } }`, {}, adminToken);
  log(`移库单 ${move.code} 完成: ${done.data?.completeStockMoveOrder?.state} (${loc1.name}#${loc1.id} → 二道区仓#${loc2.id})`);
}

// ============ 2) 售后退货：客户下单发货 → 售后 → Received(回补) ============
async function seedAfterSales(adminToken, variantId) {
  // 注册（幂等：已存在则忽略）并登录
  let r = await shopGql(`mutation($i: RegisterCustomerInput!){ registerCustomerAccount(input: $i){ ... on Success { success } ... on ErrorResult { errorCode message } } }`, { i: { emailAddress: CUSTOMER.email, firstName: CUSTOMER.firstName, lastName: CUSTOMER.lastName, password: CUSTOMER.password } });
  log("register 结果: " + JSON.stringify(r.data?.registerCustomerAccount));
  r = await shopGql(`mutation($email: String!, $pw: String!){ login(username: $email, password: $pw){ ... on CurrentUser { id identifier } ... on InvalidCredentialsError { message } ... on NativeAuthStrategyError { message } } }`, { email: CUSTOMER.email, pw: CUSTOMER.password });
  log("login 结果: " + JSON.stringify(r.data?.login));
  const custToken = r.data?.__sessionToken;
  if (!custToken) throw new Error("客户登录失败: " + JSON.stringify(r.data));
  const me = await shopGql(`query { me { id identifier } }`, {}, custToken);
  log("me(custToken): " + JSON.stringify(me.data?.me || me.errors));

  // 登录客户下单（activeOrder 自动归属客户，售后归属校验必需）
  const order = await placeAndShipOrder(adminToken, { variantId, sessionToken: custToken });
  log(`售后源订单 ${order.orderCode} 已发货 (line#${order.lineId})`);

  // Shop 发起售后（需同客户会话）
  r = await shopGql(`query($id: ID!){ order(id: $id){ id total } }`, { id: order.orderId }, custToken);
  const total = r.data?.order?.total || 1;
  r = await shopGql(`mutation($input: CreateAfterSalesRequestInput!){ createAfterSalesRequest(input: $input){ id state refundAmount } }`, { input: { orderId: order.orderId, orderLineId: order.lineId, type: "return_refund", reason: "阶段2回归测试退货", refundAmount: total } }, custToken);
  const req = r.data?.createAfterSalesRequest;
  if (!req) throw new Error("createAfterSalesRequest 失败");
  log(`售后单 AS${req.id} 创建 (state=${req.state})`);

  // Admin approve → Shop updateReturnTracking → Admin confirmReturnReceived
  await adminGql(`mutation{ approveAfterSalesRequest(id: ${JSON.stringify(req.id)}) { id state } }`, {}, adminToken);
  r = await shopGql(`mutation{ updateReturnTracking(id: ${JSON.stringify(req.id)}, trackingNo: "SF-TEST-001", carrier: "顺丰") { id state } }`, {}, custToken);
  if (r.data?.updateReturnTracking?.state !== "Returning") throw new Error("updateReturnTracking 未到 Returning: " + JSON.stringify(r.data));
  const done = await adminGql(`mutation{ confirmReturnReceived(id: ${JSON.stringify(req.id)}, receivedQuantity: ${order.quantity}) { id state receivedQuantity } }`, {}, adminToken);
  log(`售后单 AS${req.id} 核销: ${done.data?.confirmReturnReceived?.state} (received=${done.data?.confirmReturnReceived?.receivedQuantity})`);
  return { reqId: req.id, order };
}

// ============ 3) 自提核销：自提点 + 匿名下单 + confirmPickupHandover ============
async function seedPickup(adminToken, variantId) {
  // 建自提点（幂等按名称查；默认 take 只返回前 10 条，需显式放大）
  let r = await adminGql(`query { pickupLocations(options: { take: 200 }) { totalItems items { id name } } }`, {}, adminToken);
  let pl = (r.data?.pickupLocations?.items || []).find(x => x.name === "长春旗舰店");
  if (!pl) {
    const c = await adminGql(`mutation{ createPickupLocation(input: { name: "长春旗舰店", type: store, address: "朝阳区人民大街 2000 号", city: "${CITY}", phoneNumber: "0431-88880000", coordinates: { lat: 43.8260, lng: 125.3240 }, isPublic: true }){ id name } }`, {}, adminToken);
    pl = c.data?.createPickupLocation;
    if (!pl) throw new Error("createPickupLocation 失败: " + JSON.stringify(c.data));
    log(`建自提点 #${pl.id} 长春旗舰店`);
  } else {
    log(`复用自提点 #${pl.id} 长春旗舰店`);
  }

  // 匿名自提订单：用唯一 guest 邮箱，避免与已注册客户 phase2-seed@example.com 冲突（EmailAddressConflictError）
  const guestEmail = `pickup-guest-${Date.now()}@example.com`;
  const order = await placeAndShipOrder(adminToken, { variantId, pickupLocationId: pl.id, email: guestEmail });
  // 核销（返回 Order，读 pickupClaimed 标记）
  r = await adminGql(`mutation{ confirmPickupHandover(orderId: ${JSON.stringify(order.orderId)}) { id code state customFields { deliveryType pickupClaimed } } }`, {}, adminToken);
  log(`自提订单 ${order.orderCode} 核销: ${JSON.stringify(r.data?.confirmPickupHandover || r.data)}`);
  return { order, pickupLocationId: pl.id };
}

(async () => {
  const adminToken = await adminLogin();
  log("admin LOGIN_OK");

  // 找有货商品 variant
  const list = await shopGql(`query($opts: ProductListOptions){ products(options:$opts){ totalItems items { id name variants { id sku name } } } }`, { opts: { take: 50 } });
  const items = list.data?.products?.items || [];
  const variant = items.flatMap(p => (p.variants || []).map(v => ({ ...v, productName: p.name })))[0];
  if (!variant) throw new Error("无商品");
  log(`使用商品: ${variant.productName}/${variant.name} variant#${variant.id}`);

  await seedStockMove(adminToken, variant.id);
  await seedAfterSales(adminToken, variant.id);
  await seedPickup(adminToken, variant.id);

  log("数据准备完成，可运行: node tools/e2e-phase2.mjs " + SHOP + " " + ADMIN);
})().catch((e) => { console.log("ERR:", e.message); process.exit(1); });
