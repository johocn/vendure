#!/usr/bin/env node
// 阶段6「OrderPackage 状态机与状态回写」端到端验证
//
// 前置（dev server 运行中）：shop-a 渠道；双仓 Default(1)、二道区仓(2)；NF-WATER-500 两仓有库存
//
// 验证状态机全链路 + 幂等 + 非法流转：
//   t1 下单拆两仓 → confirmSplitPlan → 两包 status=pending
//   t2 batchCreateFulfillment(P1) → P1 shipped（self）；P2 仍 pending
//   t3 createDelivery(P2) → P2 shipped + deliveryOrderId；mockDeliveryEvent(delivered) → P2 delivered
//   t4 markPackageDelivered(P1) → P1 delivered（self 人工确认）
//   t5 对已 delivered 的 P1 再 markPackageDelivered → 幂等 true，状态不变、deliveredAt 不重置
//   t6 另建订单 createDelivery(P3) → mockDeliveryEvent(cancelled) → P3 cancelled + cancelledAt
//   t7 对 cancelled 的 P3 调 markPackageDelivered → false（非法流转忽略），状态仍 cancelled
//   t8 回归阶段5断言：发货回填/配送回填/幂等不翻倍
//
// 用法: node tools/e2e-phase6-order-package-state.mjs [shop-api] [admin-api]
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
    if (r.errors) console.log("[ship-err]", r.errors.map(e => e.message).join(" | "));
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
async function orderPackages(token, orderId) {
  const r = await adminGql(
    `query($orderId: ID!){ orderPackages(orderId: $orderId){ id code orderId stockLocationId lines { orderLineId quantity } shippingFee deliveryMode fulfillmentId deliveryOrderId status shippedAt deliveredAt cancelledAt createdAt updatedAt } }`,
    { orderId },
    token,
  );
  return r.data?.orderPackages || [];
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
async function mockEvent(token, deliveryOrderNo, status) {
  const r = await adminGql(
    `mutation($deliveryOrderNo: String!, $status: String!, $reason: String){ mockDeliveryEvent(deliveryOrderNo: $deliveryOrderNo, status: $status, reason: $reason) }`,
    { deliveryOrderNo, status, reason: null },
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
async function placeOrder({ variantId, qty, email, coords }) {
  let token = "";
  let r = await shopGql(`query { activeOrder { id } }`);
  token = r.data?.__sessionToken || "";
  r = await shopGql(`mutation($id: ID!, $q: Int!){ addItemToOrder(productVariantId: $id, quantity: $q){ ... on Order { id code state } ... on ErrorResult { message } } }`, { id: variantId, q: qty }, token);
  token = r.data?.__sessionToken || token;
  const o = r.data?.addItemToOrder;
  if (!o?.id) throw new Error(`addItemToOrder 失败: ${JSON.stringify(o)}`);
  const orderId = o.id;
  r = await shopGql(`mutation{ setCustomerForOrder(input: { emailAddress: "${email}", firstName: "拆单", lastName: "验证" }){ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  if (coords) {
    r = await shopGql(`mutation{ setOrderCustomFields(input: { customFields: { lat: ${coords.lat}, lng: ${coords.lng} } }){ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
    token = r.data?.__sessionToken || token;
  }
  r = await shopGql(`mutation{ setOrderShippingAddress(input: { fullName: "拆单验证", streetLine1: "测试街道1号", city: "长春市", countryCode: "CN" }){ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  r = await shopGql(`query { eligibleShippingMethods { id code } }`, {}, token);
  token = r.data?.__sessionToken || token;
  const methods = r.data?.eligibleShippingMethods || [];
  const sm = methods.find(m => m.code === SPLIT_SHIPPING_CODE) || methods[0];
  if (!sm) throw new Error("无可用配送方式");
  r = await shopGql(`mutation($id: ID!){ setOrderShippingMethod(shippingMethodId: [$id]){ ... on Order { id } ... on ErrorResult { message } } }`, { id: sm.id }, token);
  token = r.data?.__sessionToken || token;
  r = await shopGql(`mutation{ transitionOrderToState(state: "ArrangingPayment"){ ... on Order { id code state } ... on OrderStateTransitionError { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  const tr = r.data?.transitionOrderToState;
  if (!tr || tr.__typename === "OrderStateTransitionError") throw new Error(`转入 ArrangingPayment 失败: ${JSON.stringify(tr)}`);
  return { orderId, code: tr.code, token };
}
function parseDetail(raw) {
  try {
    const arr = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function sumQty(detail) {
  return detail.reduce((s, x) => s + (Number(x.quantity) || 0), 0);
}
function sumPlanQty(plan) {
  return (plan?.packages || []).reduce((s, p) => s + (p.lines || []).reduce((a, l) => a + (Number(l.quantity) || 0), 0), 0);
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
  console.log(`== 阶段6 OrderPackage 状态机与状态回写 e2e == SHOP=${SHOP} ADMIN=${ADMIN}`);
  const adminToken = await adminLogin();
  if (!adminToken) { console.log("Admin 登录失败"); process.exit(1); }
  const TARGET_AVAIL = 5;
  let lineId = "";
  let variantId = "1";
  try {
    // ---- 0. 前置：定位 variant + 渠道配置 + 双仓可售各 5 ----
    const pl = await adminGql(`query{ products(options:{ take: 100 }){ items{ id name variants{ id sku name stockLevels{ stockOnHand stockAllocated stockLocationId } } } } }`, {}, adminToken);
    const v = pl.data?.products?.items?.flatMap(x => (x.variants || []).map(vv => ({ ...vv, productName: x.name }))).find(vv => vv.sku === VARIANT_SKU);
    if (!v) { result("前置.找到多仓商品", false, `未找到 ${VARIANT_SKU}`); process.exit(1); }
    variantId = v.id;
    await setChannelCustomFields(adminToken, { shippingStrategy: "nearest", stockLocationPriority: JSON.stringify([{ locationId: "1", priority: 1 }, { locationId: "2", priority: 2 }]), memberStockStrategy: null });
    await ensureSplitShippingMethod(adminToken);
    await adminGql(`mutation($id: ID!, $cf: UpdateChannelCustomFieldsInput!){ updateChannel(input: { id: $id, customFields: $cf }){ ... on Channel { id } } }`, { id: "2", cf: { packageShippingRule: PACKAGE_RULES } }, adminToken);
    result("前置.双仓可售重置为各 5", await resetTwoLocStock(adminToken, v.id, TARGET_AVAIL),
      (v?.stockLevels || []).map(l => `#${l.stockLocationId} onHand=${l.stockOnHand} alloc=${l.stockAllocated}`).join(" | "));

    // ---- 1. 下单拆两仓 → confirmSplitPlan → 两包 pending ----
    const order = await placeOrder({ variantId: v.id, qty: ORDER_QTY, email: `pkg6-${Date.now()}@example.com`, coords: NEAR_ANCHOR });
    const o1 = await readOrder(adminToken, order.orderId);
    lineId = o1?.lines?.[0]?.id || "";
    const planB5A3 = [
      { stockLocationId: LOC_PRIORITY, lines: [{ orderLineId: lineId, quantity: 5 }] },
      { stockLocationId: LOC_DEFAULT, lines: [{ orderLineId: lineId, quantity: 3 }] },
    ];
    const r1 = await confirmSplitPlan(adminToken, order.orderId, planB5A3);
    const pkgs1 = await orderPackages(adminToken, order.orderId);
    const t1 = !!r1.data?.confirmSplitPlan && pkgs1.length === 2 &&
      pkgs1.every(p => p.status === "pending" && !p.shippedAt && !p.deliveredAt && !p.cancelledAt);
    result("t1.拆单确认 → 两包 pending", t1,
      pkgs1.length ? JSON.stringify(pkgs1.map(p => `${p.code}:${p.status}`)) : "orderPackages 为空");

    // ---- 2. 发货 P1 → P1 shipped（self）；P2 仍 pending ----
    const ship1 = await shipOrder(adminToken, order.orderId, "P1", 1000, `SF${Date.now()}`);
    const pkgs2 = await orderPackages(adminToken, order.orderId);
    const p1 = pkgs2.find(p => p.code === "P1");
    const p2 = pkgs2.find(p => p.code === "P2");
    const t2 = ship1.data?.batchCreateFulfillment?.items?.[0]?.success === true && !!p1 && !!p2 &&
      p1.status === "shipped" && !!p1.shippedAt && !!p1.fulfillmentId && Number(p1.shippingFee) === 1000 &&
      p2.status === "pending";
    result("t2.发货回填 P1 shipped(ful+1000)，P2 仍 pending", t2,
      pkgs2.length ? JSON.stringify(pkgs2.map(p => `${p.code}:${p.status}:ful=${p.fulfillmentId}:fee=${p.shippingFee}`)) : "orderPackages 为空");

    // ---- 3. 同城配送 P2 → createDelivery 后 P2 shipped；delivered 事件 → P2 delivered ----
    const dlv = await createDelivery(adminToken, { orderId: order.orderId, packageId: "P2" });
    const pkgs3a = await orderPackages(adminToken, order.orderId);
    const p2s = pkgs3a.find(p => p.code === "P2");
    const t3a = !!dlv && !!p2s && p2s.status === "shipped" && !!p2s.deliveryOrderId;
    result("t3a.createDelivery → P2 shipped + deliveryOrderId 回填", t3a,
      dlv ? `delivery#${dlv.id} code=${dlv.code} pkg=P2 orderPackage=${p2s?.status}` : "createDelivery 失败");
    if (!dlv?.code) { result("前置.拿到配送单号", false, "无 code，终止"); throw new Error("stop"); }
    // 配送状态机合法链：pending→accepted→pickup→delivered（pending 不能直接 delivered）
    await mockEvent(adminToken, dlv.code, "accepted");
    await mockEvent(adminToken, dlv.code, "pickup");
    const ev1 = await mockEvent(adminToken, dlv.code, "delivered");
    const pkgs3b = await orderPackages(adminToken, order.orderId);
    const p2d = pkgs3b.find(p => p.code === "P2");
    const t3b = !!ev1 && !!p2d && p2d.status === "delivered" && !!p2d.deliveredAt;
    result("t3b.mockDeliveryEvent(accepted→pickup→delivered) → P2 delivered + deliveredAt", t3b,
      p2d ? `${p2d.code}:${p2d.status}` : "orderPackages 为空");

    // ---- 4. self 包人工确认 P1 delivered ----
    const m1 = await markDelivered(adminToken, order.orderId, "P1");
    const pkgs4 = await orderPackages(adminToken, order.orderId);
    const p1d = pkgs4.find(p => p.code === "P1");
    const t4 = m1 === true && !!p1d && p1d.status === "delivered" && !!p1d.deliveredAt;
    result("t4.markPackageDelivered(P1) → P1 delivered + deliveredAt", t4,
      p1d ? `${p1d.code}:${p1d.status}` : "orderPackages 为空");

    // ---- 5. 幂等：已 delivered 再 markPackageDelivered ----
    const before = p1d?.deliveredAt;
    const m5 = await markDelivered(adminToken, order.orderId, "P1");
    const pkgs5 = await orderPackages(adminToken, order.orderId);
    const p1e = pkgs5.find(p => p.code === "P1");
    const t5 = m5 === true && p1e?.status === "delivered" && String(p1e?.deliveredAt) === String(before);
    result("t5.重复 markPackageDelivered 幂等（状态不变、deliveredAt 不重置）", t5,
      p1e ? `${p1e.code}:${p1e.status} before=${before}` : "orderPackages 为空");

    // ---- 6. 另建订单：createDelivery(P3) → cancelled 事件 → P3 cancelled ----
    await resetTwoLocStock(adminToken, v.id, TARGET_AVAIL);
    const order2 = await placeOrder({ variantId: v.id, qty: ORDER_QTY, email: `pkg6b-${Date.now()}@example.com`, coords: NEAR_ANCHOR });
    const o2 = await readOrder(adminToken, order2.orderId);
    const lineId2 = o2?.lines?.[0]?.id || "";
    const planB5A3b = [
      { stockLocationId: LOC_PRIORITY, lines: [{ orderLineId: lineId2, quantity: 5 }] },
      { stockLocationId: LOC_DEFAULT, lines: [{ orderLineId: lineId2, quantity: 3 }] },
    ];
    await confirmSplitPlan(adminToken, order2.orderId, planB5A3b);
    const dlv2 = await createDelivery(adminToken, { orderId: order2.orderId, packageId: "P2" });
    if (!dlv2?.code) { result("t6前置.createDelivery", false, "无 code，终止"); throw new Error("stop"); }
    const ev2 = await mockEvent(adminToken, dlv2.code, "cancelled");
    const pkgs6 = await orderPackages(adminToken, order2.orderId);
    const p3 = pkgs6.find(p => p.code === "P2");
    const t6 = !!ev2 && !!p3 && p3.status === "cancelled" && !!p3.cancelledAt;
    result("t6.mockDeliveryEvent(cancelled) → P3 cancelled + cancelledAt", t6,
      p3 ? `${p3.code}:${p3.status}` : "orderPackages 为空");

    // ---- 7. 非法流转：对 cancelled 的 P3 调 markPackageDelivered → 忽略，仍 cancelled ----
    const m7 = await markDelivered(adminToken, order2.orderId, "P2");
    const pkgs7 = await orderPackages(adminToken, order2.orderId);
    const p3c = pkgs7.find(p => p.code === "P2");
    const t7 = m7 === false && p3c?.status === "cancelled";
    result("t7.非法流转 cancelled→delivered 被忽略", t7,
      p3c ? `${p3c.code}:${p3c.status} markReturned=${m7}` : "orderPackages 为空");

    // ---- 8. 回归阶段5：发货回填/配送回填/幂等不翻倍（订单1 校验） ----
    const pkgs8 = await orderPackages(adminToken, order.orderId);
    const t8 = pkgs8.length === 2 &&
      !!pkgs8.find(p => p.code === "P1" && p.fulfillmentId && Number(p.shippingFee) === 1000 && p.deliveryOrderId == null) &&
      !!pkgs8.find(p => p.code === "P2" && p.deliveryOrderId && p.fulfillmentId == null);
    result("t8.回归阶段5（P1 发货回填/P2 配送回填/不串包）", t8,
      pkgs8.length ? JSON.stringify(pkgs8.map(p => `${p.code}:${p.status}:ful=${p.fulfillmentId}:dlv=${p.deliveryOrderId}`)) : "orderPackages 为空");
  } catch (e) {
    result("执行异常", false, e?.message ?? String(e));
  } finally {
    console.log(`\n结果: PASS ${passed} / FAIL ${failed} / SKIP ${skipped}`);
    process.exit(failed > 0 ? 1 : 0);
  }
})();
