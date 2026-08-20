#!/usr/bin/env node
// 阶段10「履约闭环：订单状态机由包裹生命周期驱动 + 交易完成终态」端到端验证
//
// 前置（dev server 运行中）：shop-a 渠道；双仓 Default(1)、二道区仓(2)；NF-WATER-500 两仓有库存；
// dummy-payment 支付方式挂载 shop-a（seed 03 已配置，automaticSettle=false → 需 admin settlePayment）
//
// 验证：
//   t1 客户A 下单拆两仓 + 支付 → PaymentSettled；confirmSplitPlan → 2 包 pending（订单仍 PaymentSettled）
//   t2 batchCreateFulfillment(P1) → P1 shipped + fulfillment 镜像 Shipped；订单 PartiallyShipped
//   t3 batchCreateFulfillment(P2) → P2 shipped；订单 Shipped
//   t4 markPackageDelivered(P1) → P1 delivered + fulfillment 镜像 Delivered；订单 PartiallyDelivered
//   t5 markPackageDelivered(P2) → P2 delivered；订单 Delivered + fulfillmentDeliveredAt 非空
//   t6 admin completeOrder → Completed；再调幂等 true
//   t7 city 全链路：客户B 下单支付 → confirmSplitPlan → createDelivery(P1/P2) → mockDeliveryEvent(delivered)
//        → 订单 Shipped→Delivered（无 fulfillment 不被 checkFulfillmentStates 拦截）→ C端 confirmOrderReceipt → Completed（幂等）
//   t8 自动完成：客户C 下单支付 → 拆单 → 发货 → 送达 → 订单 Delivered → admin 回拨 fulfillmentDeliveredAt 至 30 天前
//        → runAutoCompleteScan → 订单 Completed，返回计数 ≥1
//
// 用法: node tools/e2e-phase10-fulfillment-closure.mjs [shop-api] [admin-api]
// 退出码: 0=通过 1=存在FAIL
const SHOP = process.argv[2] || "http://127.0.0.1:3000/shop-api";
const ADMIN = process.argv[3] || "http://127.0.0.1:3000/admin-api";
const CHANNEL_TOKEN = "shop-a-token";
const VARIANT_SKU = "NF-WATER-500";
const LOC_PRIORITY = "2";
const LOC_DEFAULT = "1";
const NEAR_ANCHOR = { lat: 43.8502, lng: 125.4232 };
const ORDER_QTY = 8;
const SPLIT_SHIPPING_CODE = "split-package-shipping-method";
const SHOP_A_CHANNEL_ID = "2";
const SPLIT_CARRIER = "SF";
const PACKAGE_RULES = JSON.stringify([
  { locationId: LOC_DEFAULT, baseFee: 800, perKmFee: 150, freeThreshold: 0 },
  { locationId: LOC_PRIORITY, baseFee: 1000, perKmFee: 200, freeThreshold: 0 },
]);

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
  for (const [u, p] of [["superadmin", "superadmin"], ["superadmin@china.test", "superadmin"], ["superadmin", "admin123"], ["superadmin@china.test", "admin123"]]) {
    const r = await adminGql(`mutation{login(username:"${u}",password:"${p}"){... on CurrentUser{identifier}... on InvalidCredentialsError{message}}}`);
    if (r.data?.__authToken) return r.data.__authToken;
  }
  return null;
}
async function setChannelCustomFields(token, cf) {
  const r = await adminGql(
    `mutation($id: ID!, $cf: UpdateChannelCustomFieldsInput!){ updateChannel(input: { id: $id, customFields: $cf }){ ... on Channel { id customFields{ shippingStrategy stockLocationPriority memberStockStrategy packageShippingRule } } } }`,
    { id: "2", cf },
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
async function ensureSplitShippingMethod(token) {
  const q = await adminGql(`query{ shippingMethods(options:{take:200}){ items{ id code } } }`, {}, token);
  let method = (q.data?.shippingMethods?.items || []).find(m => m.code === SPLIT_SHIPPING_CODE);
  if (!method) {
    const r = await adminGql(
      `mutation($input: CreateShippingMethodInput!){ createShippingMethod(input: $input){ id code } }`,
      { input: { code: SPLIT_SHIPPING_CODE, fulfillmentHandler: "manual-fulfillment", checker: { code: "default-shipping-eligibility-checker", arguments: [{ name: "orderMinimum", value: "0" }] }, calculator: { code: "split-package-shipping", arguments: [] }, translations: [{ languageCode: "zh_Hans", name: "每包独立计费(拆单)", description: "多仓拆单每包裹独立计费" }] } },
      token,
    );
    method = r.data?.createShippingMethod;
  }
  if (!method) return null;
  await adminGql(
    `mutation($input: AssignShippingMethodsToChannelInput!){ assignShippingMethodsToChannel(input: $input){ id } }`,
    { input: { shippingMethodIds: [String(method.id)], channelId: "2" } },
    token,
  );
  return method;
}
async function readOrder(token, orderId) {
  const r = await adminGql(
    `query($id: ID!){ order(id: $id){ id code state active customFields{ fulfillmentDeliveredAt } lines { id quantity } } }`,
    { id: orderId },
    token,
  );
  return r.data?.order;
}
async function confirmSplitPlan(token, orderId, packages) {
  return adminGql(
    `mutation($orderId: ID!, $packages: [SplitPackageInput!]!){ confirmSplitPlan(orderId: $orderId, packages: $packages){ orderId packages { packageId stockLocationId lines { orderLineId quantity } estimatedShippingFee deliveryMode } } }`,
    { orderId, packages },
    token,
  );
}
async function shipOrder(token, orderId, packageId, shippingFee, trackingNo) {
  return adminGql(
    `mutation($items: [BatchFulfillmentItem!]!){ batchCreateFulfillment(items: $items){ items { orderId success trackId error } } }`,
    { items: [{ orderId, trackingNo, carrierCode: SPLIT_CARRIER, packageId, shippingFee }] },
    token,
  );
}
async function orderPackages(token, orderId) {
  const r = await adminGql(
    `query($orderId: ID!){ orderPackages(orderId: $orderId){ id code status shippedAt deliveredAt fulfillmentId deliveryOrderId } }`,
    { orderId },
    token,
  );
  return r.data?.orderPackages || [];
}
async function readOrderFulfillments(token, orderId) {
  const r = await adminGql(
    `query($id: ID!){ order(id: $id){ id fulfillments { id state customFields { packageId } } } }`,
    { id: orderId },
    token,
  );
  return r.data?.order?.fulfillments || [];
}
async function markDelivered(token, orderId, packageId) {
  const r = await adminGql(
    `mutation($orderId: ID!, $packageId: String!){ markPackageDelivered(orderId: $orderId, packageId: $packageId) }`,
    { orderId, packageId },
    token,
  );
  return r.data?.markPackageDelivered;
}
async function createDelivery(token, { orderId, packageId }) {
  const r = await adminGql(
    `mutation($input: DeliveryCreateInput!){ createDelivery(input: $input){ id code orderId status fee } }`,
    { input: { orderId, packageId, providerCode: "mock", pickup: { name: "门店A(二道区)", address: "二道区测试门店", lat: 43.8502, lng: 125.4232, phone: "0431-10086" }, dropoff: { name: "收货人", address: "朝阳区测试街道1号", lat: 43.8600, lng: 125.4332, phone: "13800000000" }, items: [{ name: "矿泉水", quantity: 1 }] } },
    token,
  );
  return r.data?.createDelivery;
}
async function mockEvent(token, deliveryOrderNo, status) {
  const r = await adminGql(
    `mutation($deliveryOrderNo: String!, $status: String!){ mockDeliveryEvent(deliveryOrderNo: $deliveryOrderNo, status: $status) }`,
    { deliveryOrderNo, status },
    token,
  );
  return r.data?.mockDeliveryEvent;
}
async function completeOrder(token, orderId) {
  const r = await adminGql(
    `mutation($orderId: ID!){ completeOrder(orderId: $orderId) }`,
    { orderId },
    token,
  );
  return r.data?.completeOrder;
}
async function runAutoCompleteScan(token) {
  const r = await adminGql(`mutation{ runAutoCompleteScan }`, {}, token);
  return r.data?.runAutoCompleteScan;
}
async function setOrderCustomFields(token, orderId, customFields) {
  const r = await adminGql(
    `mutation($id: ID!, $cf: UpdateOrderCustomFieldsInput!){ setOrderCustomFields(input: { id: $id, customFields: $cf }){ ... on Order { id customFields{ fulfillmentDeliveredAt } } } }`,
    { id: orderId, cf: customFields },
    token,
  );
  return r.data?.setOrderCustomFields;
}
async function confirmOrderReceipt(token, orderId) {
  const r = await shopGql(
    `mutation($orderId: ID!){ confirmOrderReceipt(orderId: $orderId) }`,
    { orderId },
    token,
  );
  return r.data?.confirmOrderReceipt;
}
async function ensureCustomer(c) {
  await shopGql(
    `mutation($i: RegisterCustomerInput!){ registerCustomerAccount(input: $i){ ... on Success { success } ... on ErrorResult { message } } }`,
    { i: { emailAddress: c.email, firstName: c.firstName, lastName: c.lastName, password: c.password } },
  ).catch(() => {});
}
async function customerLogin(c) {
  const r = await shopGql(
    `mutation($email: String!, $pw: String!){ login(username: $email, password: $pw){ ... on CurrentUser { id } ... on InvalidCredentialsError { message } } }`,
    { email: c.email, pw: c.password },
  );
  return r.data?.__sessionToken || "";
}
async function placeOrderAsCustomer(c, variantId, qty, coords) {
  let token = await customerLogin(c);
  let ar = await shopGql(`query { activeOrder { id state } }`, {}, token);
  token = ar.data?.__sessionToken || token;
  let ao = ar.data?.activeOrder;
  if (ao?.id && ao.state !== "AddingItems") {
    const tr = await shopGql(`mutation{ transitionOrderToState(state: "Cancelled"){ ... on Order { id state } ... on OrderStateTransitionError { message } } }`, {}, token);
    token = tr.data?.__sessionToken || token;
    const ar2 = await shopGql(`query { activeOrder { id state } }`, {}, token);
    token = ar2.data?.__sessionToken || token;
    ao = ar2.data?.activeOrder;
  }
  let r;
  if (ao?.id) {
    r = await shopGql(`mutation{ removeAllOrderLines{ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
    token = r.data?.__sessionToken || token;
  }
  r = await shopGql(`mutation($id: ID!, $q: Int!){ addItemToOrder(productVariantId: $id, quantity: $q){ ... on Order { id code } ... on ErrorResult { message } } }`, { id: variantId, q: qty }, token);
  token = r.data?.__sessionToken || token;
  const o = r.data?.addItemToOrder;
  if (!o?.id) throw new Error(`addItemToOrder 失败: ${JSON.stringify(o)}`);
  r = await shopGql(`mutation{ setOrderCustomFields(input: { customFields: { lat: ${coords.lat}, lng: ${coords.lng} } }){ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  r = await shopGql(`mutation{ setOrderShippingAddress(input: { fullName: "阶段10验证", streetLine1: "测试街道1号", city: "长春市", countryCode: "CN" }){ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  r = await shopGql(`query { eligibleShippingMethods { id code } }`, {}, token);
  token = r.data?.__sessionToken || token;
  const sm = (r.data?.eligibleShippingMethods || []).find(m => m.code === SPLIT_SHIPPING_CODE) || (r.data?.eligibleShippingMethods || [])[0];
  if (!sm) throw new Error("无可用配送方式");
  r = await shopGql(`mutation($id: ID!){ setOrderShippingMethod(shippingMethodId: [$id]){ ... on Order { id } ... on ErrorResult { message } } }`, { id: sm.id }, token);
  token = r.data?.__sessionToken || token;
  r = await shopGql(`mutation{ transitionOrderToState(state: "ArrangingPayment"){ ... on Order { id code state } ... on OrderStateTransitionError { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  const tr = r.data?.transitionOrderToState;
  if (!tr?.id || tr.__typename === "OrderStateTransitionError") throw new Error(`转入 ArrangingPayment 失败: ${JSON.stringify(tr)}`);
  return { token, orderId: tr.id, code: tr.code };
}
/** 支付并结算：addPaymentToOrder（Authorized）→ admin settlePayment → 订单 PaymentSettled */
async function payAndSettle(shopToken, adminToken, orderId) {
  let r = await shopGql(`query { eligiblePaymentMethods { code } }`, {}, shopToken);
  const pay = (r.data?.eligiblePaymentMethods || [])[0];
  if (!pay) throw new Error("无可用支付方式");
  r = await shopGql(`mutation($code: String!){ addPaymentToOrder(input: { method: $code, metadata: {} }){ ... on Order { id state } ... on ErrorResult { message } } }`, { code: pay.code }, shopToken);
  const o = r.data?.addPaymentToOrder;
  if (!o?.id || o.__typename === "ErrorResult") throw new Error(`addPaymentToOrder 失败: ${JSON.stringify(o)}`);
  const pm = await adminGql(`query($id: ID!){ order(id: $id){ id state payments { id state } } }`, { id: orderId }, adminToken);
  const payments = pm.data?.order?.payments || [];
  const auth = payments.find(p => p.state === "Authorized");
  const paymentId = auth?.id || payments.find(p => p.state === "Settled")?.id;
  console.log(`[pay-diag] order=${orderId} orderState=${pm.data?.order?.state} payments=[${payments.map(p => p.id + ":" + p.state)}]`);
  if (!paymentId) throw new Error("未找到 Authorized/Settled 支付");
  const sr = await adminGql(`mutation($id: ID!){ settlePayment(id: $id){ ... on Payment { id state } } }`, { id: paymentId }, adminToken);
  console.log(`[pay-diag] settlePayment(${paymentId}) -> ${sr.data?.settlePayment?.state}`);
  const aft = await adminGql(`query($id: ID!){ order(id: $id){ state } }`, { id: orderId }, adminToken);
  console.log(`[pay-diag] order=${orderId} orderAfterSettle=${aft.data?.order?.state}`);
  return true;
}
async function resetTwoLocStock(token, variantId, targetAvail) {
  const pl = await adminGql(`query{ products(options:{ take: 100 }){ items{ variants{ id sku stockLevels{ stockOnHand stockAllocated stockLocationId } } } } }`, {}, token);
  const v = pl.data?.products?.items?.flatMap(x => x.variants || []).find(x => x.sku === VARIANT_SKU);
  const res = [];
  for (const locId of [LOC_DEFAULT, LOC_PRIORITY]) {
    const lv = (v?.stockLevels || []).find(l => String(l.stockLocationId) === String(locId));
    const onHand = targetAvail + (lv?.stockAllocated ?? 0);
    res.push(await setVariantStock(token, v.id, locId, onHand));
  }
  return res.every(Boolean);
}

(async () => {
  console.log(`== 阶段10 履约闭环 e2e == SHOP=${SHOP} ADMIN=${ADMIN}`);
  const adminToken = await adminLogin();
  if (!adminToken) { console.log("Admin 登录失败"); process.exit(1); }
  const TARGET_AVAIL = 5;
  const orders = [];
  try {
    // ---- 0. 前置：variant + 渠道配置 + 双仓可售各 5 + 客户A/B/C ----
    const pl = await adminGql(`query{ products(options:{ take: 100 }){ items{ id name variants{ id sku name stockLevels{ stockOnHand stockAllocated stockLocationId } } } } }`, {}, adminToken);
    const v = pl.data?.products?.items?.flatMap(x => (x.variants || []).map(vv => ({ ...vv, productName: x.name }))).find(vv => vv.sku === VARIANT_SKU);
    if (!v) { result("前置.找到多仓商品", false, `未找到 ${VARIANT_SKU}`); process.exit(1); }
    await setChannelCustomFields(adminToken, { shippingStrategy: "nearest", stockLocationPriority: JSON.stringify([{ locationId: "1", priority: 1 }, { locationId: "2", priority: 2 }]), memberStockStrategy: null });
    await ensureSplitShippingMethod(adminToken);
    await adminGql(`mutation($id: ID!, $cf: UpdateChannelCustomFieldsInput!){ updateChannel(input: { id: $id, customFields: $cf }){ ... on Channel { id } } }`, { id: "2", cf: { packageShippingRule: PACKAGE_RULES } }, adminToken);
    result("前置.双仓可售重置为各 5", await resetTwoLocStock(adminToken, v.id, TARGET_AVAIL),
      (v?.stockLevels || []).map(l => `#${l.stockLocationId} onHand=${l.stockOnHand} alloc=${l.stockAllocated}`).join(" | "));
    const CUSTOMER_A = { email: "pkg10a@example.com", password: "Test@123", firstName: "阶段10", lastName: "客户A" };
    const CUSTOMER_B = { email: "pkg10b@example.com", password: "Test@123", firstName: "阶段10", lastName: "客户B" };
    const CUSTOMER_C = { email: "pkg10c@example.com", password: "Test@123", firstName: "阶段10", lastName: "客户C" };
    await ensureCustomer(CUSTOMER_A);
    await ensureCustomer(CUSTOMER_B);
    await ensureCustomer(CUSTOMER_C);

    // ================= 场景1（self 包链路）：t1-t6 =================
    const order = await placeOrderAsCustomer(CUSTOMER_A, v.id, ORDER_QTY, NEAR_ANCHOR);
    orders.push({ token: order.token, orderId: order.orderId });
    // 先确认拆单（applyAdjustment 落定每包运费）再支付：否则支付额不含运费 → checkPaymentsCoverTotal 失败
    const o1 = await readOrder(adminToken, order.orderId);
    const lineId = o1?.lines?.[0]?.id || "";

    // ---- t1: 拆两仓(每包运费已定) + 支付 → PaymentSettled；2 包 pending ----
    const planB5A3 = [
      { stockLocationId: LOC_PRIORITY, lines: [{ orderLineId: lineId, quantity: 5 }] },
      { stockLocationId: LOC_DEFAULT, lines: [{ orderLineId: lineId, quantity: 3 }] },
    ];
    const r1 = await confirmSplitPlan(adminToken, order.orderId, planB5A3);
    // t1 断言「订单仍 PaymentSettled」需在支付后校验
    await payAndSettle(order.token, adminToken, order.orderId);
    const pkgs1 = await orderPackages(adminToken, order.orderId);
    const od1 = await readOrder(adminToken, order.orderId);
    const t1 = !!r1.data?.confirmSplitPlan && pkgs1.length === 2 &&
      pkgs1.every(p => p.status === "pending") && od1?.state === "PaymentSettled";
    result("t1.下单支付拆单 → 2 包 pending，订单仍 PaymentSettled", t1,
      `order=${od1?.state} pkgs=${JSON.stringify(pkgs1.map(p => p.code + ":" + p.status))}`);

    // ---- t2: batchCreateFulfillment(P1) → P1 shipped + fulfillment 镜像 Shipped；订单 PartiallyShipped ----
    const ship1 = await shipOrder(adminToken, order.orderId, "P1", 1000, `SF10P1${Date.now()}`);
    const shipItem1 = ship1.data?.batchCreateFulfillment?.items?.[0];
    const pkgs2 = await orderPackages(adminToken, order.orderId);
    const p1s = pkgs2.find(p => p.code === "P1");
    const fulfs2 = await readOrderFulfillments(adminToken, order.orderId);
    const f1 = fulfs2.find(f => f.customFields?.packageId === "P1");
    const od2 = await readOrder(adminToken, order.orderId);
    const t2 = shipItem1?.success === true && !!p1s && p1s.status === "shipped" && !!p1s.fulfillmentId &&
      f1?.state === "Shipped" && od2?.state === "PartiallyShipped";
    result("t2.发货P1 → P1 shipped + fulfillment Shipped(镜像) + 订单 PartiallyShipped", t2,
      `order=${od2?.state} pkg=${p1s?.status} ful=${f1?.state}`);

    // ---- t3: batchCreateFulfillment(P2) → P2 shipped；订单 Shipped ----
    const ship2 = await shipOrder(adminToken, order.orderId, "P2", 800, `SF10P2${Date.now()}`);
    const shipItem2 = ship2.data?.batchCreateFulfillment?.items?.[0];
    const pkgs3 = await orderPackages(adminToken, order.orderId);
    const p2s = pkgs3.find(p => p.code === "P2");
    const od3 = await readOrder(adminToken, order.orderId);
    const t3 = shipItem2?.success === true && !!p2s && p2s.status === "shipped" && od3?.state === "Shipped";
    result("t3.发货P2 → P2 shipped + 订单 Shipped", t3, `order=${od3?.state} pkg=${p2s?.status}`);

    // ---- t4: markPackageDelivered(P1) → P1 delivered + fulfillment 镜像 Delivered；订单 PartiallyDelivered ----
    const m4 = await markDelivered(adminToken, order.orderId, "P1");
    const pkgs4 = await orderPackages(adminToken, order.orderId);
    const p1d = pkgs4.find(p => p.code === "P1");
    const fulfs4 = await readOrderFulfillments(adminToken, order.orderId);
    const f1d = fulfs4.find(f => f.customFields?.packageId === "P1");
    const od4 = await readOrder(adminToken, order.orderId);
    const t4 = m4 === true && !!p1d && p1d.status === "delivered" && !!p1d.deliveredAt &&
      f1d?.state === "Delivered" && od4?.state === "PartiallyDelivered";
    result("t4.送达P1 → P1 delivered + fulfillment Delivered(镜像) + 订单 PartiallyDelivered", t4,
      `order=${od4?.state} pkg=${p1d?.status} ful=${f1d?.state}`);

    // ---- t5: markPackageDelivered(P2) → P2 delivered；订单 Delivered + fulfillmentDeliveredAt 非空 ----
    const m5 = await markDelivered(adminToken, order.orderId, "P2");
    const pkgs5 = await orderPackages(adminToken, order.orderId);
    const p2d = pkgs5.find(p => p.code === "P2");
    const od5 = await readOrder(adminToken, order.orderId);
    const t5 = m5 === true && !!p2d && p2d.status === "delivered" && !!p2d.deliveredAt &&
      od5?.state === "Delivered" && !!od5?.customFields?.fulfillmentDeliveredAt;
    result("t5.送达P2 → P2 delivered + 订单 Delivered + fulfillmentDeliveredAt 已写", t5,
      `order=${od5?.state} pkg=${p2d?.status} deliveredAt=${od5?.customFields?.fulfillmentDeliveredAt}`);

    // ---- t6: admin completeOrder → Completed；再调幂等 true ----
    const c6 = await completeOrder(adminToken, order.orderId);
    const od6 = await readOrder(adminToken, order.orderId);
    const c6b = await completeOrder(adminToken, order.orderId);
    const t6 = c6 === true && od6?.state === "Completed" && c6b === true;
    result("t6.admin completeOrder → Completed（再调幂等 true）", t6, `order=${od6?.state} first=${c6} again=${c6b}`);

    // ================= 场景2（city 全链路 + C端确认收货）：t7 =================
    await resetTwoLocStock(adminToken, v.id, TARGET_AVAIL);
    const order7 = await placeOrderAsCustomer(CUSTOMER_B, v.id, ORDER_QTY, NEAR_ANCHOR);
    orders.push({ token: order7.token, orderId: order7.orderId });
    // 先拆单(落定每包运费)再支付，避免支付额不含运费 → checkPaymentsCoverTotal 失败
    const o7 = await readOrder(adminToken, order7.orderId);
    const lineId7 = o7?.lines?.[0]?.id || "";
    const r7plan = await confirmSplitPlan(adminToken, order7.orderId, [
      { stockLocationId: LOC_PRIORITY, lines: [{ orderLineId: lineId7, quantity: 5 }] },
      { stockLocationId: LOC_DEFAULT, lines: [{ orderLineId: lineId7, quantity: 3 }] },
    ]);
    await payAndSettle(order7.token, adminToken, order7.orderId);
    // city：对两个包都 createDelivery（无 fulfillment，验证不被 checkFulfillmentStates 拦截）
    const dlv1 = await createDelivery(adminToken, { orderId: order7.orderId, packageId: "P1" });
    const dlv2 = await createDelivery(adminToken, { orderId: order7.orderId, packageId: "P2" });
    const pkgs7a = await orderPackages(adminToken, order7.orderId);
    const od7a = await readOrder(adminToken, order7.orderId);
    const p1c = pkgs7a.find(p => p.code === "P1");
    const p2c = pkgs7a.find(p => p.code === "P2");
    // 两个包 createDelivery 后均 shipped，无 fulfillment → 订单应直接到 Shipped（不被拦截）
    const t7a = !!r7plan.data?.confirmSplitPlan && !!dlv1 && !!dlv2 &&
      p1c?.status === "shipped" && p2c?.status === "shipped" &&
      p1c?.fulfillmentId == null && p2c?.fulfillmentId == null &&
      od7a?.state === "Shipped";
    result("t7a.city createDelivery(P1/P2) → 两包 shipped(无fulfillment) + 订单 Shipped", t7a,
      `order=${od7a?.state} pkgs=${JSON.stringify(pkgs7a.map(p => p.code + ":" + p.status + ":ful=" + p.fulfillmentId))}`);
    if (!dlv1?.code || !dlv2?.code) { result("t7前置.拿到配送单号", false, "无 code，终止"); throw new Error("stop"); }
    // 配送状态机：accepted→pickup→delivered（pending 不能直接 delivered）
    await mockEvent(adminToken, dlv1.code, "accepted");
    await mockEvent(adminToken, dlv1.code, "pickup");
    await mockEvent(adminToken, dlv1.code, "delivered");
    await mockEvent(adminToken, dlv2.code, "accepted");
    await mockEvent(adminToken, dlv2.code, "pickup");
    await mockEvent(adminToken, dlv2.code, "delivered");
    const pkgs7b = await orderPackages(adminToken, order7.orderId);
    const od7b = await readOrder(adminToken, order7.orderId);
    const p1dd = pkgs7b.find(p => p.code === "P1");
    const p2dd = pkgs7b.find(p => p.code === "P2");
    const t7b = p1dd?.status === "delivered" && p2dd?.status === "delivered" &&
      od7b?.state === "Delivered" && !!od7b?.customFields?.fulfillmentDeliveredAt;
    result("t7b.mockDeliveryEvent(delivered) ×2 → 两包 delivered + 订单 Delivered", t7b,
      `order=${od7b?.state} pkgs=${JSON.stringify(pkgs7b.map(p => p.code + ":" + p.status))}`);
    // C端确认收货（归属校验 + Delivered→Completed，幂等）
    const c7 = await confirmOrderReceipt(order7.token, order7.orderId);
    const od7c = await readOrder(adminToken, order7.orderId);
    const c7b = await confirmOrderReceipt(order7.token, order7.orderId);
    const t7c = c7 === true && od7c?.state === "Completed" && c7b === true;
    result("t7c.C端 confirmOrderReceipt → Completed（幂等 true）", t7c, `order=${od7c?.state} first=${c7} again=${c7b}`);

    // ================= 场景3（自动交易完成）：t8 =================
    await resetTwoLocStock(adminToken, v.id, TARGET_AVAIL);
    const order8 = await placeOrderAsCustomer(CUSTOMER_C, v.id, ORDER_QTY, NEAR_ANCHOR);
    orders.push({ token: order8.token, orderId: order8.orderId });
    // 先拆单(落定每包运费)再支付，避免支付额不含运费 → checkPaymentsCoverTotal 失败
    const o8 = await readOrder(adminToken, order8.orderId);
    const lineId8 = o8?.lines?.[0]?.id || "";
    await confirmSplitPlan(adminToken, order8.orderId, [
      { stockLocationId: LOC_PRIORITY, lines: [{ orderLineId: lineId8, quantity: 5 }] },
      { stockLocationId: LOC_DEFAULT, lines: [{ orderLineId: lineId8, quantity: 3 }] },
    ]);
    await payAndSettle(order8.token, adminToken, order8.orderId);
    await shipOrder(adminToken, order8.orderId, "P1", 1000, `SF10P1${Date.now()}`);
    await shipOrder(adminToken, order8.orderId, "P2", 800, `SF10P2${Date.now()}`);
    await markDelivered(adminToken, order8.orderId, "P1");
    await markDelivered(adminToken, order8.orderId, "P2");
    const od8 = await readOrder(adminToken, order8.orderId);
    const t8pre = od8?.state === "Delivered" && !!od8?.customFields?.fulfillmentDeliveredAt;
    result("t8前置.全链路送达 → 订单 Delivered + fulfillmentDeliveredAt 已写", t8pre, `order=${od8?.state}`);
    // 回拨 fulfillmentDeliveredAt 至 30 天前（模拟超期），然后 runAutoCompleteScan
    const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const setR = await setOrderCustomFields(adminToken, order8.orderId, { fulfillmentDeliveredAt: past });
    const n8 = await runAutoCompleteScan(adminToken);
    const od8b = await readOrder(adminToken, order8.orderId);
    const t8 = !!setR && typeof n8 === "number" && n8 >= 1 && od8b?.state === "Completed";
    result("t8.回拨 deliveredAt → runAutoCompleteScan → 订单 Completed（计数≥1）", t8,
      `set=${JSON.stringify(setR)} count=${n8} order=${od8b?.state}`);
  } catch (e) {
    result("执行异常", false, e?.message ?? String(e));
  } finally {
    for (const o of orders) {
      await adminGql(
        `mutation{ transitionOrderToState(id: "${o.orderId}", state: "Cancelled"){ ... on Order { id state } ... on OrderStateTransitionError { message } } }`,
        {},
        adminToken,
      ).catch(() => {});
    }
    console.log(`\n结果: PASS ${passed} / FAIL ${failed} / SKIP ${skipped}`);
    process.exit(failed > 0 ? 1 : 0);
  }
})();
