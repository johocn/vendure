#!/usr/bin/env node
// 阶段5「OrderPackage 实体持久化（追溯底座）」端到端验证
//
// 前置（dev server 运行中）：
//   - shop-a 渠道；双仓：Default(1)、二道区仓(2)；NF-WATER-500 在两仓均有库存记录
//
// 验证落库 + 订单级包裹查询 + 发货/配送回填 + 幂等：
//   1) 下单 8 件（定位靠近 B 仓）→ 自动拆两仓（B5/A3）
//   2) confirmSplitPlan 手动确认 2 包 → orderPackages(orderId) 返回 2 条
//      P1=B/5、P2=A/3，deliveryMode='self'，shippingFee=估算值(0)
//   3) batchCreateFulfillment 整单发货（packageId=P1, fee=1000）
//      → orderPackages P1 回填 fulfillmentId + fee=1000；P2 未被误回填（按包精确匹配，不串包）
//   4) 再次 confirmSplitPlan（同计划）→ orderPackages 仍 2 条（幂等，不翻倍）
//   5) createDelivery（P2 同城配送）→ orderPackages P2.deliveryOrderId 非空
//
// 用法:
//   node tools/e2e-phase5-order-package.mjs [shop-api] [admin-api]
// 退出码: 0=通过  1=存在FAIL
const SHOP = process.argv[2] || "http://127.0.0.1:3000/shop-api";
const ADMIN = process.argv[3] || "http://127.0.0.1:3000/admin-api";
const CHANNEL_TOKEN = "shop-a-token";
const VARIANT_SKU = "NF-WATER-500";
const LOC_PRIORITY = "2"; // 二道区仓（B 仓，nearest 命中优先）
const LOC_DEFAULT = "1"; // Default（A 仓）
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
    `query($orderId: ID!){ orderPackages(orderId: $orderId){ id code orderId stockLocationId lines { orderLineId quantity } shippingFee deliveryMode fulfillmentId deliveryOrderId createdAt updatedAt } }`,
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

(async () => {
  console.log(`== 阶段5 OrderPackage 实体持久化 e2e == SHOP=${SHOP} ADMIN=${ADMIN}`);
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
    const reset = [];
    for (const locId of [LOC_DEFAULT, LOC_PRIORITY]) {
      const lv = (v?.stockLevels || []).find(l => String(l.stockLocationId) === String(locId));
      const onHand = TARGET_AVAIL + (lv?.stockAllocated ?? 0);
      reset.push(await setVariantStock(adminToken, v.id, locId, onHand));
    }
    result("前置.双仓可售重置为各 5", reset.every(Boolean), (v?.stockLevels || []).map(l => `#${l.stockLocationId} onHand=${l.stockOnHand} alloc=${l.stockAllocated}`).join(" | "));

    // ---- 1. 下单 8 件（定位靠近 B 仓）→ 自动拆两仓 ----
    const order = await placeOrder({ variantId: v.id, qty: ORDER_QTY, email: `pkg-${Date.now()}@example.com`, coords: NEAR_ANCHOR });
    result("t1.下单 8 件到 ArrangingPayment", !!order.orderId, `code=${order.code}`);
    const o1 = await readOrder(adminToken, order.orderId);
    const line0 = o1?.lines?.[0];
    lineId = line0?.id || "";
    const d1 = line0 ? parseDetail(line0.customFields?.stockLocationsJson) : [];
    const t1 = d1.length === 2 && sumQty(d1) === ORDER_QTY;
    result("t1.自动拆单 → stockLocationsJson 拆两仓", t1, d1.length ? JSON.stringify(d1) : `raw=${line0?.customFields?.stockLocationsJson}`);

    // ---- 2. confirmSplitPlan 手动确认 2 包（B5/A3）→ orderPackages 落库 2 条 ----
    const planB5A3 = [
      { stockLocationId: LOC_PRIORITY, lines: [{ orderLineId: lineId, quantity: 5 }] },
      { stockLocationId: LOC_DEFAULT, lines: [{ orderLineId: lineId, quantity: 3 }] },
    ];
    const r2 = await confirmSplitPlan(adminToken, order.orderId, planB5A3);
    const plan2 = r2.data?.confirmSplitPlan;
    const pkgs2 = await orderPackages(adminToken, order.orderId);
    const t2 = !!plan2 && (plan2.packages || []).length === 2 && sumPlanQty(plan2) === ORDER_QTY &&
      pkgs2.length === 2 &&
      String(pkgs2[0].stockLocationId) === LOC_PRIORITY && pkgs2[0].code === "P1" && sumQty(pkgs2[0].lines) === 5 &&
      String(pkgs2[1].stockLocationId) === LOC_DEFAULT && pkgs2[1].code === "P2" && sumQty(pkgs2[1].lines) === 3 &&
      pkgs2.every(p => p.deliveryMode === "self");
    result("t2.orderPackages 落库 2 包（P1=B5/P2=A3, self）", t2,
      pkgs2.length ? JSON.stringify(pkgs2.map(p => `${p.code}:#${p.stockLocationId}:${sumQty(p.lines)}:${p.deliveryMode}:fee=${p.shippingFee}`)) : `errors=${JSON.stringify(r2.errors?.map(e => e.message))}`);

    // ---- 3. 整单发货（packageId=P1）→ 对应包回填 fulfillmentId + 实际运费（按包精确匹配，不串包） ----
    const ship1 = await shipOrder(adminToken, order.orderId, "P1", 1000, `SF${Date.now()}`);
    const okShip = ship1.data?.batchCreateFulfillment?.items?.[0]?.success === true;
    const pkgs3 = await orderPackages(adminToken, order.orderId);
    const p1 = pkgs3.find(p => p.code === "P1");
    const p2 = pkgs3.find(p => p.code === "P2");
    const t3 = okShip && !!p1 && !!p2 &&
      !!p1.fulfillmentId && Number(p1.shippingFee) === 1000 &&
      !p2.fulfillmentId && Number(p2.shippingFee) === 0;
    result("t3.发货回填对应包(fulfillmentId+实际运费)，未发货包不被误回填", t3,
      pkgs3.length ? JSON.stringify(pkgs3.map(p => `${p.code}:ful=${p.fulfillmentId}:fee=${p.shippingFee}`)) : "orderPackages 为空");

    // ---- 4. 重复确认（幂等）→ orderPackages 仍 2 条，不翻倍 ----
    // 前置：t3 整单发货扣减了双仓 onHand（B 仓 5→0），而 confirmSplitPlan 以物理 onHand 校验货量；
    // 幂等验证需要 confirmSplitPlan 再次成功，故先重置双仓可售各 5（不影响主链路业务逻辑）。
    const lv4 = await adminGql(`query{ products(options:{ take: 100 }){ items{ variants{ id sku stockLevels{ stockOnHand stockAllocated stockLocationId } } } } }`, {}, adminToken);
    const v4 = lv4.data?.products?.items?.flatMap(x => x.variants || []).find(x => x.sku === VARIANT_SKU);
    const reset4 = [];
    for (const locId of [LOC_DEFAULT, LOC_PRIORITY]) {
      const lvl = (v4?.stockLevels || []).find(l => String(l.stockLocationId) === String(locId));
      const onHand = TARGET_AVAIL + (lvl?.stockAllocated ?? 0);
      reset4.push(await setVariantStock(adminToken, v.id, locId, onHand));
    }
    result("t4前置.重置双仓可售各 5", reset4.every(Boolean),
      (v4?.stockLevels || []).map(l => `#${l.stockLocationId} onHand=${l.stockOnHand} alloc=${l.stockAllocated}`).join(" | "));
    const r4 = await confirmSplitPlan(adminToken, order.orderId, planB5A3);
    const plan4 = r4.data?.confirmSplitPlan;
    const pkgs4 = await orderPackages(adminToken, order.orderId);
    const t4 = !!plan4 && pkgs4.length === 2 && sumQty(pkgs4.flatMap(p => p.lines)) === ORDER_QTY;
    result("t4.重复确认幂等（仍 2 条不翻倍）", t4, `packages=${pkgs4.length}`);

    // ---- 5. 同城配送：createDelivery(P2) → orderPackages P2.deliveryOrderId 非空 ----
    const dlv = await createDelivery(adminToken, { orderId: order.orderId, packageId: "P2" });
    const pkgs5 = await orderPackages(adminToken, order.orderId);
    const p2b = pkgs5.find(p => p.code === "P2");
    const t5 = !!dlv && !!p2b && !!p2b.deliveryOrderId && String(p2b.deliveryOrderId) === String(dlv.id);
    result("t5.配送单创建回填 deliveryOrderId", t5,
      dlv ? `delivery#${dlv.id} code=${dlv.code} pkg=P2 orderPackage.deliveryOrderId=${p2b?.deliveryOrderId}` : "createDelivery 失败");
  } catch (e) {
    result("执行异常", false, e?.message ?? String(e));
  } finally {
    console.log(`\n结果: PASS ${passed} / FAIL ${failed} / SKIP ${skipped}`);
    process.exit(failed > 0 ? 1 : 0);
  }
})();
