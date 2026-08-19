#!/usr/bin/env node
// 阶段3 Task3「拆单履约工作流」端到端验证
//
// 前置（dev server 运行中）：
//   - shop-a 渠道（token=shop-a-token）；双仓：Default(1)、二道区仓(2)
//   - NF-WATER-500（variant id 动态查）在两仓均有库存记录
//
// 验证拆单履约（OrderSplitPlan 抽象 + 自动拆单 + 手动调单 + Admin resolver）：
//   1) 构造双仓各 5 件可售、下单 8 件（定位靠近二道区仓 → nearest 命中 B 仓先分配）
//      → OrderLine.stockLocationsJson 拆成两仓（{loc2:5, loc1:3}）
//   2) admin splitPlanPreview(orderId) 返回 2 个包，数量合计 8
//   3) 手动调单：把 B 仓整包改到 A 仓且数量守恒 → confirmSplitPlan 成功（1 包 8 件）
//   4) 手动调单：数量不守恒（合计 7 ≠ 8）→ 断言 UserInputError「数量不守恒」
//   5) 手动调单：把整单改到低库存仓（onHand=7 < 8）→ 断言 UserInputError「货量不足」
//
// 用法:
//   node tools/e2e-phase3-split.mjs                          # 默认 127.0.0.1:3000
//   node tools/e2e-phase3-split.mjs <shop-api> <admin-api>
// 退出码: 0=通过(含SKIP)  1=存在FAIL
const SHOP = process.argv[2] || "http://127.0.0.1:3000/shop-api";
const ADMIN = process.argv[3] || "http://127.0.0.1:3000/admin-api";
const CHANNEL_TOKEN = "shop-a-token";
const VARIANT_SKU = "NF-WATER-500";
const LOC_PRIORITY = "2"; // 二道区仓（B 仓，nearest 命中优先）
const LOC_DEFAULT = "1"; // Default（A 仓）
const NEAR_ANCHOR = { lat: 43.8502, lng: 125.4232 }; // 与二道区仓坐标一致 → 就近命中 B 仓
const ORDER_QTY = 8; // 下单 8 件 → 双仓各 5 件可售 → 拆两仓（B 仓 5 + A 仓 3）

// Task4 每包独立计费：split-package-shipping 计费配送方式 + channel 级每包运费规则
const SPLIT_SHIPPING_CODE = "split-package-shipping-method";
const SHOP_A_CHANNEL_ID = "2";
const SPLIT_CARRIER = "SF"; // carrier-dictionary 中的有效编码（大写）
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
    `query($id: ID!){ order(id: $id){ id code state shippingWithTax shippingLines { shippingMethod { code } } lines { id quantity customFields { stockLocationId stockLocationsJson } } customFields { packageShippingJson shippingAdjustment } } }`,
    { id: orderId },
    token,
  );
  return r.data?.order;
}
async function splitPlanPreview(token, orderId) {
  const r = await adminGql(
    `query($orderId: ID!){ splitPlanPreview(orderId: $orderId){ orderId packages { packageId stockLocationId lines { orderLineId quantity } estimatedShippingFee deliveryMode } } }`,
    { orderId },
    token,
  );
  return r.data?.splitPlanPreview;
}
async function confirmSplitPlan(token, orderId, packages) {
  const r = await adminGql(
    `mutation($orderId: ID!, $packages: [SplitPackageInput!]!){ confirmSplitPlan(orderId: $orderId, packages: $packages){ orderId packages { packageId stockLocationId lines { orderLineId quantity } estimatedShippingFee deliveryMode } } }`,
    { orderId, packages },
    token,
  );
  return r;
}

// ---- Task4 每包独立计费辅助 ----

// 幂等创建使用 split-package-shipping 计费器的配送方式，并确保归入 shop-a 渠道
async function ensureSplitShippingMethod(token) {
  const q = await adminGql(`query{ shippingMethods(options:{take:200}){ items{ id code calculator{ code } } } }`, {}, token);
  let method = (q.data?.shippingMethods?.items || []).find(m => m.code === SPLIT_SHIPPING_CODE);
  if (!method) {
    const r = await adminGql(
      `mutation($input: CreateShippingMethodInput!){ createShippingMethod(input: $input){ id code } }`,
      {
        input: {
          code: SPLIT_SHIPPING_CODE,
          fulfillmentHandler: "manual-fulfillment",
          checker: { code: "default-shipping-eligibility-checker", arguments: [{ name: "orderMinimum", value: "0" }] },
          calculator: { code: "split-package-shipping", arguments: [] },
          translations: [{ languageCode: "zh_Hans", name: "每包独立计费(拆单)", description: "多仓拆单每包裹独立计费" }],
        },
      },
      token,
    );
    method = r.data?.createShippingMethod;
    if (r.errors) console.log("[ship-err]", r.errors.map(e => e.message).join(" | "));
  }
  if (!method) return null;
  const assign = await adminGql(
    `mutation($input: AssignShippingMethodsToChannelInput!){ assignShippingMethodsToChannel(input: $input){ id } }`,
    { input: { shippingMethodIds: [String(method.id)], channelId: SHOP_A_CHANNEL_ID } },
    token,
  );
  return { id: method.id, assigned: (assign.data?.assignShippingMethodsToChannel || []).length > 0 };
}

// 计费器将 packageShippingJson 异步落库，轮询等待明细出现
async function waitForPackageShipping(token, orderId, tries = 15, delayMs = 300) {
  for (let i = 0; i < tries; i++) {
    const o = await readOrder(token, orderId);
    if (parseDetail(o?.customFields?.packageShippingJson).length > 0) return o;
    await new Promise(res => setTimeout(res, delayMs));
  }
  return readOrder(token, orderId);
}

// 发货（batchCreateFulfillment），并回写 Fulfillment.packageId/shippingFee
async function shipOrder(token, orderId, packageId, shippingFee, trackingNo) {
  return adminGql(
    `mutation($items: [BatchFulfillmentItem!]!){ batchCreateFulfillment(items: $items){ items { orderId success trackId error } } }`,
    { items: [{ orderId, trackingNo, carrierCode: SPLIT_CARRIER, packageId, shippingFee }] },
    token,
  );
}

// 读取订单 Fulfillment 记录（校验 packageId/shippingFee 回写）
async function readOrderFulfillments(token, orderId) {
  const r = await adminGql(
    `query($id: ID!){ order(id: $id){ id fulfillments { id state customFields { packageId shippingFee } } } }`,
    { id: orderId },
    token,
  );
  return r.data?.order?.fulfillments || [];
}

// 下单流程（匿名会话 → ArrangingPayment，触发 Matrix 分配并写入拆分明细）
async function placeOrder({ variantId, qty, email, coords }) {
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
  if (!o || o.__typename === "ErrorResult") throw new Error(`addItemToOrder 失败: ${JSON.stringify(o)}`);
  const orderId = o.id;

  r = await shopGql(
    `mutation{ setCustomerForOrder(input: { emailAddress: "${email}", firstName: "拆单", lastName: "验证" }){ ... on Order { id } ... on ErrorResult { message } } }`,
    {},
    token,
  );
  token = r.data?.__sessionToken || token;
  const so = r.data?.setCustomerForOrder;
  if (!so || so.__typename === "ErrorResult") throw new Error(`setCustomerForOrder 失败: ${JSON.stringify(so)}`);

  if (coords) {
    r = await shopGql(
      `mutation{ setOrderCustomFields(input: { customFields: { lat: ${coords.lat}, lng: ${coords.lng} } }){ ... on Order { id } ... on ErrorResult { message } } }`,
      {},
      token,
    );
    token = r.data?.__sessionToken || token;
  }
  r = await shopGql(
    `mutation{ setOrderShippingAddress(input: { fullName: "拆单验证", streetLine1: "测试街道1号", city: "长春市", countryCode: "CN" }){ ... on Order { id } ... on ErrorResult { message } } }`,
    {},
    token,
  );
  token = r.data?.__sessionToken || token;
  r = await shopGql(`query { eligibleShippingMethods { id code } }`, {}, token);
  token = r.data?.__sessionToken || token;
  const methods = r.data?.eligibleShippingMethods || [];
  // 优先选择 split-package-shipping 计费配送方式（Task4 每包独立计费），否则回退第一个
  const sm = methods.find(m => m.code === SPLIT_SHIPPING_CODE) || methods[0];
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
  return { orderId, code: tr.code, token, shippingMethodCode: sm.code };
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
function sumQty(detail) {
  return detail.reduce((s, x) => s + (Number(x.quantity) || 0), 0);
}
function sumFee(detail) {
  return detail.reduce((s, x) => s + (Number(x.fee) || 0), 0);
}
function sumPlanQty(plan) {
  return (plan?.packages || []).reduce((s, p) => s + (p.lines || []).reduce((a, l) => a + (Number(l.quantity) || 0), 0), 0);
}

(async () => {
  console.log(`== 阶段3 拆单履约 e2e == SHOP=${SHOP} ADMIN=${ADMIN}`);
  const adminToken = await adminLogin();
  if (!adminToken) { console.log("Admin 登录失败"); process.exit(1); }
  const baseCf = { shippingStrategy: "priority", stockLocationPriority: null, memberStockStrategy: null };
  const orders = []; // 测试单，finally 中取消并释放库存占用
  const origStock = {}; // 库存还原快照 { [locId]: { onHand } }
  const TARGET_AVAIL = 5; // 双仓各 5 件可售 → 下单 8 强制拆两仓
  let variantId = "1";
  let lineId = "";
  try {
    // ---- 0. 前置：定位 variant ----
    const pl = await adminGql(`query{ products(options:{ take: 100 }){ items{ id name variants{ id sku name stockLevels{ stockOnHand stockAllocated stockLocationId } } } } }`, {}, adminToken);
    const v = pl.data?.products?.items?.flatMap(x => (x.variants || []).map(vv => ({ ...vv, productName: x.name }))).find(vv => vv.sku === VARIANT_SKU);
    if (!v) { result("前置.找到多仓商品", false, `未找到 ${VARIANT_SKU}`); process.exit(1); }
    variantId = v.id;
    for (const lv of (v.stockLevels || [])) {
      origStock[String(lv.stockLocationId)] = { onHand: lv.stockOnHand };
    }

    // ---- 0.3 loc2 归入 shop-a 渠道（多仓前置，含缓存失效） ----
    const okAssign = await ensureLoc2InShopA(adminToken);
    result("前置.loc2 归入 shop-a 渠道", okAssign, "assign + 缓存失效 touch");

    // ---- 0.5 库存配置：双仓各 5 件可售（loc1/loc2 onHand = 5 + 各自已分配） ----
    const levels0 = v.stockLevels || [];
    const setOk = [];
    for (const locId of [LOC_DEFAULT, LOC_PRIORITY]) {
      const lv = levels0.find(l => String(l.stockLocationId) === String(locId));
      const onHand = TARGET_AVAIL + (lv?.stockAllocated ?? 0);
      setOk.push(await setVariantStock(adminToken, v.id, locId, onHand));
    }
    result("前置.双仓各 5 件可售", setOk.every(Boolean), `loc1.onHand=${TARGET_AVAIL + (levels0.find(l => String(l.stockLocationId) === LOC_DEFAULT)?.stockAllocated ?? 0)} loc2.onHand=${TARGET_AVAIL + (levels0.find(l => String(l.stockLocationId) === LOC_PRIORITY)?.stockAllocated ?? 0)}`);

    // ---- 0.6 渠道策略：nearest（定位靠近 B 仓 → B 仓先分配，余量溢到 A 仓） ----
    const setupCf = { shippingStrategy: "nearest", stockLocationPriority: JSON.stringify([{ locationId: "1", priority: 1 }, { locationId: "2", priority: 2 }]), memberStockStrategy: null };
    const ch = await setChannelCustomFields(adminToken, setupCf);
    result("配置.nearest 写入渠道", ch?.customFields?.shippingStrategy === "nearest", JSON.stringify(ch?.customFields));

    // ---- 0.7 Task4 前置：split-package-shipping 计费配送方式 + channel 每包运费规则 ----
    const splitMethod = await ensureSplitShippingMethod(adminToken);
    result("t4前置.创建/复用 split 计费配送方式", !!splitMethod, splitMethod ? `id=${splitMethod.id} assigned=${splitMethod.assigned}` : "创建失败");
    const ch2 = await setChannelCustomFields(adminToken, { packageShippingRule: PACKAGE_RULES });
    result("t4前置.渠道 packageShippingRule 已配置", ch2?.customFields?.packageShippingRule === PACKAGE_RULES, String(ch2?.customFields?.packageShippingRule));

    // ---- 1. Test1: 下单 8 件（定位靠近 B 仓）→ 拆两仓 ----
    const ts = Date.now();
    const order1 = await placeOrder({ variantId: v.id, qty: ORDER_QTY, email: `split-auto-${ts}@example.com`, coords: NEAR_ANCHOR });
    orders.push({ token: order1.token, orderId: order1.orderId });
    result("t1.下单 8 件到 ArrangingPayment", !!order1.orderId, `code=${order1.code}`);
    const o1 = await readOrder(adminToken, order1.orderId);
    const line0 = o1?.lines?.[0];
    lineId = line0?.id || "";
    const d1 = line0 ? parseDetail(line0.customFields?.stockLocationsJson) : [];
    const t1 = d1.length === 2 && String(d1[0].locationId) === LOC_PRIORITY && sumQty(d1) === ORDER_QTY;
    result("t1.自动拆单 → stockLocationsJson 拆两仓(B先A后)", t1, d1.length ? JSON.stringify(d1) : `stockLocationsJson=${line0?.customFields?.stockLocationsJson}`);
    result("t1.主仓 stockLocationId = B 仓", line0?.customFields?.stockLocationId === LOC_PRIORITY, `主仓=#${line0?.customFields?.stockLocationId}`);

    // ---- 2. Test2: splitPlanPreview 返回 2 包 ----
    const plan = await splitPlanPreview(adminToken, order1.orderId);
    const pkgs = plan?.packages || [];
    const t2 = pkgs.length === 2 && sumPlanQty(plan) === ORDER_QTY && pkgs.every(p => (p.lines || []).length > 0);
    result("t2.splitPlanPreview 返回 2 包且数量合计=8", t2, plan ? JSON.stringify(pkgs.map(p => `#${p.stockLocationId}:${(p.lines || []).map(l => l.quantity).join("+")}`)) : JSON.stringify(plan));

    // ---- 3. Test3: 手动调单（B 仓整包改到 A 仓，数量守恒）→ 成功 ----
    const r3 = await confirmSplitPlan(adminToken, order1.orderId, [
      { stockLocationId: LOC_DEFAULT, lines: [{ orderLineId: lineId, quantity: ORDER_QTY }] },
    ]);
    const plan3 = r3.data?.confirmSplitPlan;
    const t3 = !!plan3 && (plan3.packages || []).length === 1 && String(plan3.packages[0].stockLocationId) === LOC_DEFAULT && sumPlanQty(plan3) === ORDER_QTY;
    result("t3.手动调单改仓+数量守恒成功", t3, plan3 ? `1 包 #${plan3.packages[0].stockLocationId} qty=${sumPlanQty(plan3)}` : `errors=${JSON.stringify(r3.errors?.map(e => e.message))}`);

    // ---- 4. Test4: 手动调单数量不守恒（合计 7 ≠ 8）→ 报错 ----
    const r4 = await confirmSplitPlan(adminToken, order1.orderId, [
      { stockLocationId: LOC_DEFAULT, lines: [{ orderLineId: lineId, quantity: ORDER_QTY - 1 }] },
    ]);
    const err4 = (r4.errors || []).map(e => e.message).join(" | ");
    const t4 = !r4.data?.confirmSplitPlan && /数量不守恒/.test(err4);
    result("t4.数量不守恒被拦截", t4, err4 || "（未报错）");

    // ---- 5. Test5: 手动调单货量不足（整单调到 onHand=7 的仓）→ 报错 ----
    let t5 = null;
    try {
      const setLow = await setVariantStock(adminToken, v.id, LOC_PRIORITY, ORDER_QTY - 1); // loc2 onHand=7
      if (setLow) {
        const r5 = await confirmSplitPlan(adminToken, order1.orderId, [
          { stockLocationId: LOC_PRIORITY, lines: [{ orderLineId: lineId, quantity: ORDER_QTY }] },
        ]);
        const err5 = (r5.errors || []).map(e => e.message).join(" | ");
        t5 = !r5.data?.confirmSplitPlan && /货量不足/.test(err5);
        result("t5.货量不足被拦截", t5, err5 || "（未报错）");
      } else {
        result("t5.货量不足被拦截", null, "setVariantStock 降库存失败，跳过");
      }
    } catch (e5) {
      result("t5.货量不足被拦截", null, `降库存异常，跳过: ${e5.message}`);
    }

    // ---- 6. Task4: 每包独立计费 ----
    // 6.0 前置：确认下单使用 split 计费配送方式
    const usedSplit = order1.shippingMethodCode === SPLIT_SHIPPING_CODE;
    result("t4前置.下单使用 split 计费配送方式", usedSplit, order1.shippingMethodCode);
    const rules4 = JSON.parse(PACKAGE_RULES);
    const feeFor4 = (locId) => {
      const rule = rules4.find(r => String(r.locationId) === String(locId));
      // 计费器 distanceKm 恒为 0，故 fee = baseFee + perKmFee*0 = baseFee
      return (rule?.baseFee ?? 1000) + Math.round((rule?.perKmFee ?? 200) * 0);
    };
    // 6.1 Order.packageShippingJson：两仓各一笔、金额符合 channel packageShippingRule
    const o1s = await waitForPackageShipping(adminToken, order1.orderId);
    const psDetail = parseDetail(o1s?.customFields?.packageShippingJson);
    const t6 = psDetail.length === 2 &&
      [LOC_DEFAULT, LOC_PRIORITY].every(id => psDetail.some(d => String(d.locationId) === String(id))) &&
      psDetail.every(d => Number(d.fee) === feeFor4(d.locationId));
    result("t6.packageShippingJson 每包独立计费明细(两仓各一笔)", t6,
      psDetail.length ? JSON.stringify(psDetail) : `raw=${o1s?.customFields?.packageShippingJson}`);
    // 6.2 运费合计 == Order.shippingWithTax（ShippingLine 金额）
    const psTotal = sumFee(psDetail);
    const t7 = psTotal > 0 && Number(o1s?.shippingWithTax) === psTotal;
    result("t7.运费合计 == ShippingLine 金额", t7, `psTotal=${psTotal} shippingWithTax=${o1s?.shippingWithTax}`);
    // 6.3 shippingAdjustment 默认为 0
    const t8 = Number(o1s?.customFields?.shippingAdjustment ?? 0) === 0;
    result("t8.shippingAdjustment 默认 0", t8, String(o1s?.customFields?.shippingAdjustment));
    // 6.4 发货 → Fulfillment.packageId/shippingFee 回写
    const shipRes = await shipOrder(adminToken, order1.orderId, "P1", psTotal, `SF${Date.now()}`);
    const shipItem = shipRes.data?.batchCreateFulfillment?.items?.[0];
    const fulfs4 = await readOrderFulfillments(adminToken, order1.orderId);
    const f4 = fulfs4[0];
    const t9 = shipItem?.success === true &&
      !!f4 && f4.customFields?.packageId === "P1" &&
      Number(f4.customFields?.shippingFee) === psTotal;
    result("t9.Fulfillment 回写 packageId/shippingFee", t9,
      shipItem?.success
        ? `fulfillment#${f4?.id} packageId=${f4?.customFields?.packageId} shippingFee=${f4?.customFields?.shippingFee}`
        : `shipErr=${shipItem?.error ?? JSON.stringify(shipRes.data)}`);
  } finally {
    // ---- 6. 清理：取消测试单 + 还原库存 + 渠道配置（无论成败都执行） ----
    for (const o of orders) await cancelOrder(o.token, o.orderId);
    for (const [locId, snap] of Object.entries(origStock)) {
      await setVariantStock(adminToken, variantId, locId, snap.onHand).catch(() => {});
    }
    const restored = await setChannelCustomFields(adminToken, baseCf).catch(() => null);
    result("清理.渠道配置已恢复", !!restored && restored?.customFields?.shippingStrategy === "priority" && restored?.customFields?.memberStockStrategy == null, JSON.stringify(restored?.customFields));
  }

  console.log(`\n== 结果: PASS=${passed} FAIL=${failed} SKIP=${skipped} ==`);
  console.log("== 请到 dev server 日志核对: 自动拆单 order#... 共 2 包 / 手动调单 order#... 确认 N 包 ==");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
