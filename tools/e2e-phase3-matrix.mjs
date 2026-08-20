#!/usr/bin/env node
// 阶段3 Task1/Task2「库存策略矩阵 + 拆分明细字段」端到端验证
//
// 前置（dev server 运行中）：
//   - shop-a 渠道（token=shop-a-token）；双仓：Default(1)、二道区仓(2)
//   - NF-WATER-500（variant id 动态查）在两仓均有库存（loc2 可用 >=20）
//
// 验证矩阵分发（MatrixStockLocationStrategy，渠道×配送方式×会员等级）：
//   1) nearest：shippingStrategy=nearest + 订单定位锚点靠近二道区仓 → 就近分配（日志 rule=nearest），
//      OrderLine.stockLocationsJson 已写入
//   2) member：shippingStrategy=member + memberStockStrategy=[{level:LV5,locationIds:[2],fallback:nearest}]
//      → LV5 客户命中 二道区仓（日志 rule=member:LV5），下单 25 拆两仓（stockLocationsJson 长度=2）
//   3) member 配置下 LV1 客户无命中 → 回退 nearest（主仓 Default，日志 rule=nearest）
//
// 用法:
//   node tools/e2e-phase3-matrix.mjs                          # 默认 127.0.0.1:3000
//   node tools/e2e-phase3-matrix.mjs <shop-api> <admin-api>
// 退出码: 0=通过(含SKIP)  1=存在FAIL
const SHOP = process.argv[2] || "http://127.0.0.1:3000/shop-api";
const ADMIN = process.argv[3] || "http://127.0.0.1:3000/admin-api";
const CHANNEL_TOKEN = "shop-a-token";
const VARIANT_SKU = "NF-WATER-500";
const LOC_PRIORITY = "2"; // 二道区仓（B 仓）
const LOC_DEFAULT = "1"; // Default（A 仓）
const NEAR_ANCHOR = { lat: 43.8502, lng: 125.4232 }; // 与二道区仓坐标一致 → 就近命中 B 仓

let passed = 0, failed = 0, skipped = 0;
function result(name, ok, detail) {
  const tag = ok === true ? "PASS" : ok === false ? "FAIL" : "SKIP";
  if (ok === true) passed++; else if (ok === false) failed++; else skipped++;
  console.log(`[${tag}] ${name}${detail ? " — " + detail : ""}`);
}

async function shopGql(query, variables = {}, token = "") {
  // channelTokenKey 默认为 vendure-token（dev-config 未覆盖），必须用 vendure-token 才能命中 shop-a 渠道；
  // 用错头名（vendure-channel-token）会回退到默认渠道，矩阵读到的将是默认渠道的 shippingStrategy。
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
async function setChannelCustomFields(token, cf) {
  const r = await adminGql(
    `mutation($id: ID!, $cf: UpdateChannelCustomFieldsInput!){ updateChannel(input: { id: $id, customFields: $cf }){ ... on Channel { id customFields{ shippingStrategy stockLocationPriority memberStockStrategy } } } }`,
    { id: "2", cf },
    token,
  );
  return r.data?.updateChannel;
}
async function setCustomerLevel(token, customerId, level) {
  const r = await adminGql(
    `mutation($id: ID!, $lv: Int!){ updateCustomer(input: { id: $id, customFields: { memberLevel: $lv } }){ ... on Customer { id customFields{ memberLevel } } } }`,
    { id: customerId, lv: level },
    token,
  );
  return r.data?.updateCustomer;
}
async function setVariantStock(token, variantId, locationId, stockOnHand) {
  const r = await adminGql(
    `mutation{ setVariantStock(productVariantId: ${JSON.stringify(variantId)}, stockLocationId: ${JSON.stringify(locationId)}, stockOnHand: ${stockOnHand}) }`,
    {},
    token,
  );
  return r.data?.setVariantStock === true;
}
// 把 loc2 关联到 shop-a 渠道，并触发 StockLocationEvent('updated') 使
// MultiChannelStockLocationStrategy.channelIdCache 失效（assign 本身不发事件，缓存 7 天 TTL）
async function ensureLoc2InShopA(token) {
  const assign = await adminGql(
    `mutation{ assignStockLocationsToChannel(input: { stockLocationIds: ["2"], channelId: "2" }){ id } }`,
    {},
    token,
  );
  const touch = await adminGql(
    `mutation($id: ID!){ updateStockLocation(input: { id: $id, name: "二道区仓" }){ ... on StockLocation { id } } }`,
    { id: "2" },
    token,
  );
  return !!assign.data?.assignStockLocationsToChannel?.length && !!touch.data?.updateStockLocation?.id;
}
async function readOrder(token, orderId) {
  const r = await adminGql(
    `query($id: ID!){ order(id: $id){ id code state lines { id quantity customFields { stockLocationId stockLocationsJson } } } }`,
    { id: orderId },
    token,
  );
  return r.data?.order;
}

// 下单流程（匿名会话 → ArrangingPayment，触发 Matrix 分配并写入拆分明细）
async function placeOrder({ variantId, qty, email, coords, beforeTransition }) {
  let token = "";
  let r = await shopGql(`query { activeOrder { id } }`);
  token = r.data?.__sessionToken || "";
  r = await shopGql(
    `mutation($id: ID!, $q: Int!){ addItemToOrder(productVariantId: $id, quantity: $q){ ... on Order { id code state } ... on ErrorResult { message } } }`,
    { id: variantId, q: qty },
    token,
  );
  token = r.data?.__sessionToken || token;
  const o = r.data?.addItemToOrder;
  if (!o?.id) throw new Error(`addItemToOrder 失败: ${JSON.stringify(o)}`);
  const orderId = o.id;

  r = await shopGql(
    `mutation{ setCustomerForOrder(input: { emailAddress: "${email}", firstName: "矩阵", lastName: "验证" }){ ... on Order { id } ... on ErrorResult { message } } }`,
    {},
    token,
  );
  token = r.data?.__sessionToken || token;
  const so = r.data?.setCustomerForOrder;
  if (!so || so.__typename === "ErrorResult") throw new Error(`setCustomerForOrder 失败: ${JSON.stringify(so)}`);

  if (beforeTransition) await beforeTransition(orderId);

  if (coords) {
    r = await shopGql(
      `mutation{ setOrderCustomFields(input: { customFields: { lat: ${coords.lat}, lng: ${coords.lng} } }){ ... on Order { id } ... on ErrorResult { message } } }`,
      {},
      token,
    );
    token = r.data?.__sessionToken || token;
  }
  r = await shopGql(
    `mutation{ setOrderShippingAddress(input: { fullName: "矩阵验证", streetLine1: "测试街道1号", city: "长春市", countryCode: "CN" }){ ... on Order { id } ... on ErrorResult { message } } }`,
    {},
    token,
  );
  token = r.data?.__sessionToken || token;
  r = await shopGql(`query { eligibleShippingMethods { id code } }`, {}, token);
  token = r.data?.__sessionToken || token;
  const sm = r.data?.eligibleShippingMethods?.[0];
  if (!sm) throw new Error("无可用配送方式");
  r = await shopGql(
    `mutation($id: ID!){ setOrderShippingMethod(shippingMethodId: [$id]){ ... on Order { id } ... on ErrorResult { message } } }`,
    { id: sm.id },
    token,
  );
  token = r.data?.__sessionToken || token;
  r = await shopGql(
    `mutation{ transitionOrderToState(state: "ArrangingPayment"){ ... on Order { id code state } ... on OrderStateTransitionError { message } } }`,
    {},
    token,
  );
  token = r.data?.__sessionToken || token;
  const tr = r.data?.transitionOrderToState;
  if (!tr || tr.__typename === "OrderStateTransitionError") throw new Error(`转入 ArrangingPayment 失败: ${JSON.stringify(tr)}`);
  return { orderId, code: tr.code, token };
}

async function cancelOrder(token, orderId) {
  await shopGql(
    `mutation{ transitionOrderToState(state: "Cancelled"){ ... on Order { id state } ... on OrderStateTransitionError { message } } }`,
    {},
    token,
  ).catch(() => {});
}

function parseDetail(raw) {
  try {
    const arr = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

(async () => {
  console.log(`== 阶段3 矩阵 e2e == SHOP=${SHOP} ADMIN=${ADMIN}`);
  const adminToken = await adminLogin();
  if (!adminToken) { console.log("Admin 登录失败"); process.exit(1); }
  const baseCf = { shippingStrategy: "priority", stockLocationPriority: null, memberStockStrategy: null };
  const orders = []; // 测试单，finally 中取消并释放库存占用
  const TARGET_AVAIL_2 = 20; // loc2(B仓) 可售目标：够 t1(5) + t2 拆单余量(15)，且 < 25 强制拆两仓
  const TARGET_AVAIL_1 = 100; // loc1(A仓) 可售目标：够 t2 拆单余量(5) + t3(5)，且充足（>20 断言）
  const origStock = {}; // 库存还原快照 { [locId]: { onHand } }
  let variantId = "1";
  try {
    // ---- 0. 前置：定位 variant ----
    const pl = await adminGql(`query{ products(options:{ take: 100 }){ items{ id name variants{ id sku name stockLevels{ stockOnHand stockAllocated stockLocationId } } } } }`, {}, adminToken);
    const v = pl.data?.products?.items?.flatMap(x => (x.variants || []).map(vv => ({ ...vv, productName: x.name }))).find(vv => vv.sku === VARIANT_SKU);
    if (!v) { result("前置.找到多仓商品", false, `未找到 ${VARIANT_SKU}`); process.exit(1); }
    variantId = v.id;
    for (const lv of (v.stockLevels || [])) {
      origStock[String(lv.stockLocationId)] = { onHand: lv.stockOnHand };
    }

    // ---- 0.3 loc2 归入 shop-a 渠道（多仓矩阵前置，含缓存失效） ----
    const okAssign = await ensureLoc2InShopA(adminToken);
    result("前置.loc2 归入 shop-a 渠道", okAssign, "assign + 缓存失效 touch");

    // ---- 0.5 库存配置：loc2(B仓) 可售=20（制造余量拆单），loc1 保持充足 ----
    const lv2 = (v.stockLevels || []).find(l => String(l.stockLocationId) === String(LOC_PRIORITY));
    if (!lv2) { result("前置.loc2 有库存记录", false, `loc#${LOC_PRIORITY} 无 stockLevel`); process.exit(1); }
    const onHand2 = TARGET_AVAIL_2 + lv2.stockAllocated;
    const set2 = await setVariantStock(adminToken, v.id, LOC_PRIORITY, onHand2);
    result("前置.配置 loc2 可售=20", set2, `loc2 onHand=${onHand2} allocated=${lv2.stockAllocated} 可售=${TARGET_AVAIL_2}`);

    // loc1(A仓) 同理重置为已知可售（累计 allocation 会侵蚀可用量，需按 目标可售+allocated 显式设 onHand）
    const lv1 = (v.stockLevels || []).find(l => String(l.stockLocationId) === String(LOC_DEFAULT));
    if (!lv1) { result("前置.loc1 有库存记录", false, `loc#${LOC_DEFAULT} 无 stockLevel`); process.exit(1); }
    const onHand1 = TARGET_AVAIL_1 + lv1.stockAllocated;
    const set1 = await setVariantStock(adminToken, v.id, LOC_DEFAULT, onHand1);
    result("前置.配置 loc1 可售=100", set1, `loc1 onHand=${onHand1} allocated=${lv1.stockAllocated} 可售=${TARGET_AVAIL_1}`);

    // 重读库存计算可用量
    const pl2 = await adminGql(`query{ products(options:{ take: 100 }){ items{ id name variants{ id sku name stockLevels{ stockOnHand stockAllocated stockLocationId } } } } }`, {}, adminToken);
    const v2 = pl2.data?.products?.items?.flatMap(x => (x.variants || []).map(vv => ({ ...vv, productName: x.name }))).find(vv => vv.sku === VARIANT_SKU);
    const levels = v2?.stockLevels || [];
    const avail = id => (levels.find(l => String(l.stockLocationId) === String(id))?.stockOnHand ?? 0) - (levels.find(l => String(l.stockLocationId) === String(id))?.stockAllocated ?? 0);
    const aLoc2 = avail(LOC_PRIORITY);
    const aLoc1 = avail(LOC_DEFAULT);
    result("前置.双仓可售", aLoc1 > 20 && aLoc2 >= TARGET_AVAIL_2, `loc1可售=${aLoc1} loc2可售=${aLoc2}（variant#${v.id} ${v.sku}）`);

    // ---- 1. 配置：构造双仓优先级 + nearest ----
    const setupCf = { shippingStrategy: "nearest", stockLocationPriority: JSON.stringify([{ locationId: "1", priority: 1 }, { locationId: "2", priority: 2 }]), memberStockStrategy: null };
    const ch = await setChannelCustomFields(adminToken, setupCf);
    result("配置.nearest 写入渠道", ch?.customFields?.shippingStrategy === "nearest", JSON.stringify(ch?.customFields));

    // ---- 2. Test1: LV1 + nearest + 定位靠近 B 仓 → 就近分配 ----
    const ts = Date.now();
    const order1 = await placeOrder({
      variantId: v.id,
      qty: 5,
      email: `matrix-nearest-${ts}@example.com`,
      coords: NEAR_ANCHOR,
    });
    orders.push({ token: order1.token, orderId: order1.orderId });
    result("t1.下单到 ArrangingPayment", !!order1.orderId, `code=${order1.code}`);
    const o1 = await readOrder(adminToken, order1.orderId);
    const d1 = o1?.lines?.[0] ? parseDetail(o1.lines[0].customFields?.stockLocationsJson) : [];
    const t1 = d1.length > 0 && String(d1[0].locationId) === LOC_PRIORITY && d1.reduce((s, x) => s + x.quantity, 0) === 5;
    result("t1.nearest 就近分配（rule=nearest，B 仓）", t1, d1.length ? JSON.stringify(d1) : `stockLocationsJson=${o1?.lines?.[0]?.customFields?.stockLocationsJson}`);
    result("t1.主仓 stockLocationId 落库", o1?.lines?.[0]?.customFields?.stockLocationId === LOC_PRIORITY, `主仓=#${o1?.lines?.[0]?.customFields?.stockLocationId}`);

    // ---- 3. 配置：member + LV5 专属 B 仓 ----
    const memberCf = { shippingStrategy: "member", stockLocationPriority: JSON.stringify([{ locationId: "1", priority: 1 }, { locationId: "2", priority: 2 }]), memberStockStrategy: JSON.stringify([{ level: "LV5", locationIds: [LOC_PRIORITY], fallback: "nearest" }]) };
    const ch2 = await setChannelCustomFields(adminToken, memberCf);
    result("配置.member 写入渠道", ch2?.customFields?.shippingStrategy === "member", JSON.stringify(ch2?.customFields));

    // ---- 4. Test2: LV5 客户 → 命中 B 仓，下单 25 拆两仓 ----
    const order2 = await placeOrder({
      variantId: v.id,
      qty: 25,
      email: `matrix-lv5-${ts}@example.com`,
      beforeTransition: async orderId => {
        const q = await adminGql(`query($id: ID!){ order(id: $id){ customer { id emailAddress } } }`, { id: orderId }, adminToken);
        const cid = q.data?.order?.customer?.id;
        if (!cid) throw new Error(`订单客户未生成: ${JSON.stringify(q.data?.order)}`);
        await setCustomerLevel(adminToken, cid, 5);
        return cid;
      },
    });
    orders.push({ token: order2.token, orderId: order2.orderId });
    result("t2.LV5 下单到 ArrangingPayment", !!order2.orderId, `code=${order2.code}`);
    const o2 = await readOrder(adminToken, order2.orderId);
    const d2 = o2?.lines?.[0] ? parseDetail(o2.lines[0].customFields?.stockLocationsJson) : [];
    const splitOk = d2.length === 2 && String(d2[0].locationId) === LOC_PRIORITY && d2.reduce((s, x) => s + x.quantity, 0) === 25;
    result("t2.member:LV5 命中 B 仓 + 余量拆两仓", splitOk, d2.length ? JSON.stringify(d2) : `stockLocationsJson=${o2?.lines?.[0]?.customFields?.stockLocationsJson}`);

    // ---- 5. Test3: 同 member 配置下 LV1 无命中 → 回退 nearest（A 仓） ----
    const order3 = await placeOrder({
      variantId: v.id,
      qty: 5,
      email: `matrix-lv1-${ts}@example.com`,
    });
    orders.push({ token: order3.token, orderId: order3.orderId });
    result("t3.LV1 下单到 ArrangingPayment", !!order3.orderId, `code=${order3.code}`);
    const o3 = await readOrder(adminToken, order3.orderId);
    const d3 = o3?.lines?.[0] ? parseDetail(o3.lines[0].customFields?.stockLocationsJson) : [];
    const t3 = d3.length > 0 && String(d3[0].locationId) === LOC_DEFAULT;
    result("t3.LV1 回退 nearest（rule=nearest，A 仓）", t3, d3.length ? JSON.stringify(d3) : `stockLocationsJson=${o3?.lines?.[0]?.customFields?.stockLocationsJson}`);
  } finally {
    // ---- 6. 清理：恢复渠道配置 + 客户等级 + 库存 + 取消测试单（无论成败都执行） ----
    // zhangsan@test.cn（id=1）恢复 LV1（探测脚本可能已改）
    await adminGql(`query{ customers(options:{ take: 1, filter: { id: { eq: "1" } } }){ items{ id } } }`, {}, adminToken)
      .then(() => setCustomerLevel(adminToken, "1", 1)).catch(() => {});
    for (const o of orders) await cancelOrder(o.token, o.orderId);
    // 还原库存（loc1/loc2 的 stockOnHand 恢复原值）
    for (const [locId, snap] of Object.entries(origStock)) {
      await setVariantStock(adminToken, variantId, locId, snap.onHand).catch(() => {});
    }
    const restored = await setChannelCustomFields(adminToken, baseCf).catch(() => null);
    result("清理.渠道配置已恢复", !!restored && restored?.customFields?.shippingStrategy === "priority" && restored?.customFields?.memberStockStrategy == null, JSON.stringify(restored?.customFields));
  }

  console.log(`\n== 结果: PASS=${passed} FAIL=${failed} SKIP=${skipped} ==`);
  console.log("== 请到 dev server 日志核对: 矩阵判定 orderLine#... rule=nearest / rule=member:LV5 ==");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
