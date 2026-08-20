#!/usr/bin/env node
// 阶段7「C端订单跟踪（Shop API）」端到端验证
//
// 前置（dev server 运行中）：shop-a 渠道；双仓 Default(1)、二道区仓(2)；NF-WATER-500 两仓有库存
//
// 验证 Shop API myOrderPackages（归属校验 + 富化 + self/city 信息组装）：
//   t1 客户A 登录下单拆两仓 → confirmSplitPlan → 2 包 status=pending，lines 富化(productName/sku)，deliveryMode 非空
//   t2 batchCreateFulfillment(P1) → P1 status=shipped + shippedAt + trackingNo/carrierName
//   t3 createDelivery(P2) + 事件链 accepted→pickup（带骑手名/电话）→ P2 骑手信息非空
//   t4 markPackageDelivered(P1) + delivered 事件 → 两包 delivered + deliveredAt
//   t5 客户B 查询客户A 的订单 → Forbidden
//   t6 未登录 token 查询 → Forbidden/Unauthorized（@Allow(Authenticated) 由 Vendure 拦截）
//   t7 未发货 self 包 tracking/carrierName/courierName 为 null
//
// 用法: node tools/e2e-phase7-shop-order-package.mjs [shop-api] [admin-api]
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
const CUSTOMER_A = { email: "pkg7a@example.com", password: "Test@123", firstName: "阶段7", lastName: "客户A" };
const CUSTOMER_B = { email: "pkg7b@example.com", password: "Test@123", firstName: "阶段7", lastName: "客户B" };

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
    { input: { shippingMethodIds: [String(method.id)], channelId: SHOP_A_CHANNEL_ID } },
    token,
  );
  return method;
}
async function readOrder(token, orderId) {
  const r = await adminGql(
    `query($id: ID!){ order(id: $id){ id code state shippingWithTax lines { id quantity customFields { stockLocationsJson } } } }`,
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
async function createDelivery(token, { orderId, packageId }) {
  const r = await adminGql(
    `mutation($input: DeliveryCreateInput!){ createDelivery(input: $input){ id code orderId status fee } }`,
    { input: { orderId, packageId, providerCode: "mock", pickup: { name: "门店A(二道区)", address: "二道区测试门店", lat: 43.8502, lng: 125.4232, phone: "0431-10086" }, dropoff: { name: "收货人", address: "朝阳区测试街道1号", lat: 43.8600, lng: 125.4332, phone: "13800000000" }, items: [{ name: "矿泉水", quantity: 1 }] } },
    token,
  );
  return r.data?.createDelivery;
}
async function mockEvent(token, deliveryOrderNo, status, courierName, courierPhone) {
  const r = await adminGql(
    `mutation($deliveryOrderNo: String!, $status: String!, $courierName: String, $courierPhone: String){ mockDeliveryEvent(deliveryOrderNo: $deliveryOrderNo, status: $status, courierName: $courierName, courierPhone: $courierPhone) }`,
    { deliveryOrderNo, status, courierName, courierPhone },
    token,
  );
  return r.data?.mockDeliveryEvent;
}
async function markDelivered(token, orderId, packageId) {
  const r = await adminGql(
    `mutation($orderId: ID!, $packageId: String!){ markPackageDelivered(orderId: $orderId, packageId: $packageId) }`,
    { orderId, packageId },
    token,
  );
  return r.data?.markPackageDelivered;
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

// ---- 阶段7新增辅助：客户注册/登录 + 以客户身份下单 + C端包裹查询 ----
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
  let r = await shopGql(`mutation{ removeAllOrderLines{ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  r = await shopGql(`mutation($id: ID!, $q: Int!){ addItemToOrder(productVariantId: $id, quantity: $q){ ... on Order { id code } ... on ErrorResult { message } } }`, { id: variantId, q: qty }, token);
  token = r.data?.__sessionToken || token;
  const o = r.data?.addItemToOrder;
  if (!o?.id) throw new Error(`addItemToOrder 失败: ${JSON.stringify(o)}`);
  r = await shopGql(`mutation{ setOrderCustomFields(input: { customFields: { lat: ${coords.lat}, lng: ${coords.lng} } }){ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  r = await shopGql(`mutation{ setOrderShippingAddress(input: { fullName: "阶段7验证", streetLine1: "测试街道1号", city: "长春市", countryCode: "CN" }){ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
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
async function myOrderPackages(token, orderId) {
  const r = await shopGql(
    `query($orderId: ID!){ myOrderPackages(orderId: $orderId){ code deliveryMode status shippedAt deliveredAt cancelledAt shippingFee lines { orderLineId quantity productName sku } trackingNo carrierName courierName courierPhone thirdPartyNo etaMinutes } }`,
    { orderId },
    token,
  );
  return r.data?.myOrderPackages || [];
}

(async () => {
  console.log(`== 阶段7 C端订单跟踪 Shop API e2e == SHOP=${SHOP} ADMIN=${ADMIN}`);
  const adminToken = await adminLogin();
  if (!adminToken) { console.log("Admin 登录失败"); process.exit(1); }
  const TARGET_AVAIL = 5;
  try {
    // ---- 0. 前置：定位 variant + 渠道配置 + 双仓可售各 5 + 注册客户A/B ----
    const pl = await adminGql(`query{ products(options:{ take: 100 }){ items{ id name variants{ id sku name stockLevels{ stockOnHand stockAllocated stockLocationId } } } } }`, {}, adminToken);
    const v = pl.data?.products?.items?.flatMap(x => (x.variants || []).map(vv => ({ ...vv, productName: x.name }))).find(vv => vv.sku === VARIANT_SKU);
    if (!v) { result("前置.找到多仓商品", false, `未找到 ${VARIANT_SKU}`); process.exit(1); }
    await setChannelCustomFields(adminToken, { shippingStrategy: "nearest", stockLocationPriority: JSON.stringify([{ locationId: "1", priority: 1 }, { locationId: "2", priority: 2 }]), memberStockStrategy: null });
    await ensureSplitShippingMethod(adminToken);
    await adminGql(`mutation($id: ID!, $cf: UpdateChannelCustomFieldsInput!){ updateChannel(input: { id: $id, customFields: $cf }){ ... on Channel { id } } }`, { id: "2", cf: { packageShippingRule: PACKAGE_RULES } }, adminToken);
    result("前置.双仓可售重置为各 5", await resetTwoLocStock(adminToken, v.id, TARGET_AVAIL),
      (v?.stockLevels || []).map(l => `#${l.stockLocationId} onHand=${l.stockOnHand} alloc=${l.stockAllocated}`).join(" | "));
    await ensureCustomer(CUSTOMER_A);
    await ensureCustomer(CUSTOMER_B);

    // ---- 1. 客户A 下单拆两仓 → confirmSplitPlan → 2 包 pending + lines 富化 ----
    const order = await placeOrderAsCustomer(CUSTOMER_A, v.id, ORDER_QTY, NEAR_ANCHOR);
    const o1 = await readOrder(adminToken, order.orderId);
    const lineId = o1?.lines?.[0]?.id || "";
    const planB5A3 = [
      { stockLocationId: LOC_PRIORITY, lines: [{ orderLineId: lineId, quantity: 5 }] },
      { stockLocationId: LOC_DEFAULT, lines: [{ orderLineId: lineId, quantity: 3 }] },
    ];
    const r1 = await confirmSplitPlan(adminToken, order.orderId, planB5A3);
    const pkgs1 = await myOrderPackages(order.token, order.orderId);
    // 注：当前拆分逻辑 deliveryMode 恒为 'self'（auto-split-plan 硬编码），此处只断言非空
    const t1 = !!r1.data?.confirmSplitPlan && pkgs1.length === 2 &&
      pkgs1.every(p => p.status === "pending" && !p.shippedAt && !p.deliveredAt && !p.cancelledAt && typeof p.deliveryMode === "string" && p.deliveryMode.length > 0) &&
      pkgs1.every(p => p.lines.length > 0 && p.lines[0].productName.length > 0 && p.lines[0].sku.length > 0);
    result("t1.拆单确认 → 2 包 pending + lines 富化(productName/sku) + deliveryMode 非空", t1,
      pkgs1.length ? JSON.stringify(pkgs1.map(p => `${p.code}:${p.status}:${p.deliveryMode}:${p.lines[0]?.productName}/${p.lines[0]?.sku}`)) : "myOrderPackages 为空");

    // ---- 2. 发货 P1（self）→ P1 shipped + trackingNo/carrierName ----
    const ship1 = await shipOrder(adminToken, order.orderId, "P1", 1000, `SF${Date.now()}`);
    const pkgs2 = await myOrderPackages(order.token, order.orderId);
    const p1 = pkgs2.find(p => p.code === "P1");
    const t2 = ship1.data?.batchCreateFulfillment?.items?.[0]?.success === true && !!p1 &&
      p1.status === "shipped" && !!p1.shippedAt && !!p1.trackingNo && !!p1.carrierName;
    result("t2.发货后 P1 status=shipped + trackingNo/carrierName non-null", t2,
      p1 ? `${p1.code}:${p1.status}:track=${p1.trackingNo}:carrier=${p1.carrierName}` : "P1 未命中");

    // ---- 3. createDelivery P2 + 事件链 accepted→pickup（带骑手）→ 骑手信息非空 ----
    const dlv = await createDelivery(adminToken, { orderId: order.orderId, packageId: "P2" });
    if (!dlv?.code) { result("前置.拿到配送单号", false, "无 code，终止"); throw new Error("stop"); }
    await mockEvent(adminToken, dlv.code, "accepted", "张三", "13800000000");
    await mockEvent(adminToken, dlv.code, "pickup", "张三", "13800000000");
    const pkgs3 = await myOrderPackages(order.token, order.orderId);
    const p2 = pkgs3.find(p => p.code === "P2");
    // 注：etaMinutes 当前 mock 链不写入（DeliveryOrder.etaMinutes 恒 null），只断言其余字段
    const t3 = !!p2 && p2.status === "shipped" && !!p2.courierName && !!p2.courierPhone && !!p2.thirdPartyNo;
    result("t3.createDelivery+pickup → P2 骑手信息非空(courierName/phone/thirdPartyNo)", t3,
      p2 ? `${p2.code}:${p2.status}:courier=${p2.courierName}/${p2.courierPhone}:3rd=${p2.thirdPartyNo}:eta=${p2.etaMinutes}` : "P2 未命中");

    // ---- 4. 签收：self 用 markPackageDelivered、city 用 delivered 事件 → 两包 delivered ----
    const m1 = await markDelivered(adminToken, order.orderId, "P1");
    const ev1 = await mockEvent(adminToken, dlv.code, "delivered", "张三", "13800000000");
    const pkgs4 = await myOrderPackages(order.token, order.orderId);
    const p1d = pkgs4.find(p => p.code === "P1");
    const p2d = pkgs4.find(p => p.code === "P2");
    const t4 = m1 === true && !!ev1 && p1d?.status === "delivered" && p2d?.status === "delivered" && !!p1d?.deliveredAt && !!p2d?.deliveredAt;
    result("t4.签收后两包 delivered + deliveredAt non-null", t4,
      pkgs4.length ? JSON.stringify(pkgs4.map(p => `${p.code}:${p.status}:${p.deliveredAt}`)) : "myOrderPackages 为空");

    // ---- 5. 权限：客户B 查询客户A 的订单 → Forbidden ----
    const tokenB = await customerLogin(CUSTOMER_B);
    const res5 = await shopGql(`query($orderId: ID!){ myOrderPackages(orderId: $orderId){ code } }`, { orderId: order.orderId }, tokenB);
    const t5 = !!res5.errors && /forbidden/i.test(res5.errors[0].message);
    result("t5.他人订单查询返回 ForbiddenError", t5, res5.errors?.[0]?.message);

    // ---- 6. 权限：未登录查询 → 未授权（@Allow(Authenticated) 由 Vendure 拦截） ----
    const res6 = await shopGql(`query($orderId: ID!){ myOrderPackages(orderId: $orderId){ code } }`, { orderId: order.orderId }, "");
    const t6 = !!res6.errors && /forbidden|unauthorized/i.test(res6.errors[0].message);
    result("t6.未登录查询返回未授权错误", t6, res6.errors?.[0]?.message);

    // ---- 7. 回归：未发货 self 包 tracking/carrierName/courierName 为 null（客户B 新订单，拆单后不发货即查） ----
    await resetTwoLocStock(adminToken, v.id, TARGET_AVAIL);
    const order2 = await placeOrderAsCustomer(CUSTOMER_B, v.id, ORDER_QTY, NEAR_ANCHOR);
    const o2 = await readOrder(adminToken, order2.orderId);
    const lineId2 = o2?.lines?.[0]?.id || "";
    await confirmSplitPlan(adminToken, order2.orderId, [
      { stockLocationId: LOC_PRIORITY, lines: [{ orderLineId: lineId2, quantity: 5 }] },
      { stockLocationId: LOC_DEFAULT, lines: [{ orderLineId: lineId2, quantity: 3 }] },
    ]);
    const pkgs7 = await myOrderPackages(order2.token, order2.orderId);
    const t7 = pkgs7.length === 2 && pkgs7.every(p => p.status === "pending" && p.trackingNo == null && p.carrierName == null && p.courierName == null);
    result("t7.未发货包 tracking/carrierName/courierName 为 null", t7,
      pkgs7.length ? JSON.stringify(pkgs7.map(p => `${p.code}:${p.status}:track=${p.trackingNo}:carrier=${p.carrierName}`)) : "myOrderPackages 为空");
  } catch (e) {
    result("执行异常", false, e?.message ?? String(e));
  } finally {
    console.log(`\n结果: PASS ${passed} / FAIL ${failed} / SKIP ${skipped}`);
    process.exit(failed > 0 ? 1 : 0);
  }
})();
