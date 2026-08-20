#!/usr/bin/env node
// 阶段8「每包独立发货（按包行过滤 fulfillment）」端到端验证
//
// 前置（dev server 运行中）：shop-a 渠道；双仓 Default(1)、二道区仓(2)；NF-WATER-500 两仓有库存
//
// 验证：
//   t1 下单拆两仓 → confirmSplitPlan → 2 包 pending，P1/P2 linesJson 正确
//   t2 batchCreateFulfillment(P1) → P1 成功、P1 fulfillment 只含 P1 行、P2 仍 pending、账本仅 1 条 Sale
//   t3 batchCreateFulfillment(P2) → P2 成功、P2 fulfillment 只含 P2 行、账本现 2 条 Sale（双仓各一）
//   t4 订单级 fulfillment 共 2 个，行不相交，行并集=订单全部行
//   t5 非拆单订单不带 packageId 发货 → 整单降级兼容
//
// 用法: node tools/e2e-phase8-per-package-fulfillment.mjs [shop-api] [admin-api]
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
const SPLIT_CARRIER = "SF";
const PACKAGE_RULES = JSON.stringify([
  { locationId: LOC_DEFAULT, baseFee: 800, perKmFee: 150, freeThreshold: 0 },
  { locationId: LOC_PRIORITY, baseFee: 1000, perKmFee: 200, freeThreshold: 0 },
]);
const CUSTOMER = { email: "pkg8a@example.com", password: "Test@123", firstName: "阶段8", lastName: "客户A" };

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
    { input: { shippingMethodIds: [String(method.id)], channelId: "2" } },
    token,
  );
  return method;
}
async function readOrder(token, orderId) {
  const r = await adminGql(
    `query($id: ID!){ order(id: $id){ id code state shippingWithTax lines { id quantity } } }`,
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
async function readOrderFulfillments(token, orderId) {
  // FulfillmentLine 含 orderLineId/quantity，可逐行校验
  const r = await adminGql(
    `query($id: ID!){ order(id: $id){ id fulfillments { id state lines { orderLineId quantity } customFields { packageId shippingFee } } } }`,
    { id: orderId },
    token,
  );
  return r.data?.order?.fulfillments || [];
}
async function placeOrderAsCustomer(c, variantId, qty, coords) {
  let token = "";
  let r = await shopGql(`mutation($i: RegisterCustomerInput!){ registerCustomerAccount(input: $i){ ... on Success { success } ... on ErrorResult { message } } }`, { i: { emailAddress: c.email, firstName: c.firstName, lastName: c.lastName, password: c.password } }).catch(() => {});
  r = await shopGql(`mutation($email: String!, $pw: String!){ login(username: $email, password: $pw){ ... on CurrentUser { id } ... on InvalidCredentialsError { message } } }`, { email: c.email, pw: c.password });
  token = r.data?.__sessionToken || "";
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
  r = await shopGql(`mutation{ setOrderShippingAddress(input: { fullName: "阶段8验证", streetLine1: "测试街道1号", city: "长春市", countryCode: "CN" }){ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
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
  console.log(`== 阶段8 每包独立发货 e2e == SHOP=${SHOP} ADMIN=${ADMIN}`);
  const adminToken = await adminLogin();
  if (!adminToken) { console.log("Admin 登录失败"); process.exit(1); }
  const TARGET_AVAIL = 5;
  const orders = []; // 测试单，finally 中取消
  try {
    // ---- 0. 前置：variant + 渠道配置 + 双仓可售各 5 ----
    const pl = await adminGql(`query{ products(options:{ take: 100 }){ items{ id name variants{ id sku name stockLevels{ stockOnHand stockAllocated stockLocationId } } } } }`, {}, adminToken);
    const v = pl.data?.products?.items?.flatMap(x => (x.variants || []).map(vv => ({ ...vv, productName: x.name }))).find(vv => vv.sku === VARIANT_SKU);
    if (!v) { result("前置.找到多仓商品", false, `未找到 ${VARIANT_SKU}`); process.exit(1); }
    await setChannelCustomFields(adminToken, { shippingStrategy: "nearest", stockLocationPriority: JSON.stringify([{ locationId: "1", priority: 1 }, { locationId: "2", priority: 2 }]), memberStockStrategy: null });
    await ensureSplitShippingMethod(adminToken);
    await adminGql(`mutation($id: ID!, $cf: UpdateChannelCustomFieldsInput!){ updateChannel(input: { id: $id, customFields: $cf }){ ... on Channel { id } } }`, { id: "2", cf: { packageShippingRule: PACKAGE_RULES } }, adminToken);
    result("前置.双仓可售重置为各 5", await resetTwoLocStock(adminToken, v.id, TARGET_AVAIL),
      (v?.stockLevels || []).map(l => `#${l.stockLocationId} onHand=${l.stockOnHand} alloc=${l.stockAllocated}`).join(" | "));

    // ---- t1: 下单拆两仓 → confirmSplitPlan → 2 包 pending ----
    const order = await placeOrderAsCustomer(CUSTOMER, v.id, ORDER_QTY, NEAR_ANCHOR);
    orders.push({ token: order.token, orderId: order.orderId });
    const o1 = await readOrder(adminToken, order.orderId);
    const lineId = o1?.lines?.[0]?.id || "";
    // 注：P1 对应 LOC_PRIORITY（B仓，5件），P2 对应 LOC_DEFAULT（A仓，3件）
    const planB5A3 = [
      { stockLocationId: LOC_PRIORITY, lines: [{ orderLineId: lineId, quantity: 5 }] },
      { stockLocationId: LOC_DEFAULT, lines: [{ orderLineId: lineId, quantity: 3 }] },
    ];
    const r1 = await confirmSplitPlan(adminToken, order.orderId, planB5A3);
    const t1 = !!r1.data?.confirmSplitPlan && r1.data.confirmSplitPlan.packages.length === 2;
    result("t1.拆单确认 → 2 包", t1,
      r1.data?.confirmSplitPlan ? JSON.stringify(
        r1.data.confirmSplitPlan.packages.map(p => `${p.packageId}:loc#${p.stockLocationId}:${(p.lines || []).map(l => l.quantity).join("+")}`)
      ) : `errors=${JSON.stringify(r1.errors?.map(e => e.message))}`);

    // ---- t2: batchCreateFulfillment(P1) → P1 成功，P2 仍 pending，账本仅 1 条 Sale ----
    const ship1 = await shipOrder(adminToken, order.orderId, "P1", 1000, `SF8P1${Date.now()}`);
    const shipItem1 = ship1.data?.batchCreateFulfillment?.items?.[0];
    const fulfs1 = await readOrderFulfillments(adminToken, order.orderId);
    const f1 = fulfs1.find(f => f.customFields?.packageId === "P1");
    // 断言：P1 fulfillment 只含 P1 行（5 件），且行=orderLineId 匹配
    const f1LinesCorrect = f1?.lines?.length === 1 && f1.lines[0].orderLineId === lineId && f1.lines[0].quantity === 5;
    // 账本：此时仅 P1 所在仓（B仓=LOC_PRIORITY=2）一条 Sale
    const lg1 = await adminGql(
      `query($bc: String!){ stockLedger(bizCode: $bc, pageSize: 50){ items { bizType direction quantity stockLocationId } } }`,
      { bc: order.code },
      adminToken,
    );
    const entries1 = (lg1.data?.stockLedger?.items || []).filter(e => e.bizType === "order" && e.direction === "out");
    const t2 = shipItem1?.success === true && !!f1 && f1LinesCorrect &&
      entries1.length === 1 && String(entries1[0].stockLocationId) === LOC_PRIORITY &&
      Number(entries1[0].quantity) === 5;
    result("t2.发货P1 → P1成功 + 行量5 + 仅1条Sale(B仓)", t2,
      shipItem1?.success
        ? `f1=${f1?.id} lines=${JSON.stringify(f1?.lines)} entries=${JSON.stringify(entries1.map(e => `#${e.stockLocationId}:${e.quantity}`))}`
        : `shipErr=${shipItem1?.error}`);

    // ---- t3: batchCreateFulfillment(P2) → P2 成功，账本现 2 条 Sale（双仓各一） ----
    const ship2 = await shipOrder(adminToken, order.orderId, "P2", 800, `SF8P2${Date.now()}`);
    const shipItem2 = ship2.data?.batchCreateFulfillment?.items?.[0];
    const fulfs2 = await readOrderFulfillments(adminToken, order.orderId);
    const f2 = fulfs2.find(f => f.customFields?.packageId === "P2");
    const f2LinesCorrect = f2?.lines?.length === 1 && f2.lines[0].orderLineId === lineId && f2.lines[0].quantity === 3;
    // 账本：现在 2 条 Sale，P1 仓(5) + P2 仓(3)
    const lg2 = await adminGql(
      `query($bc: String!){ stockLedger(bizCode: $bc, pageSize: 50){ items { bizType direction quantity stockLocationId } } }`,
      { bc: order.code },
      adminToken,
    );
    const entries2 = (lg2.data?.stockLedger?.items || []).filter(e => e.bizType === "order" && e.direction === "out");
    const locSet2 = new Set(entries2.map(e => String(e.stockLocationId)));
    const sum2 = entries2.reduce((s, e) => s + Number(e.quantity), 0);
    const t3 = shipItem2?.success === true && !!f2 && f2LinesCorrect &&
      entries2.length === 2 && locSet2.has(LOC_DEFAULT) && locSet2.has(LOC_PRIORITY) &&
      sum2 === ORDER_QTY;
    result("t3.发货P2 → P2成功 + 行量3 + 2条Sale(双仓各一,合计8)", t3,
      shipItem2?.success
        ? `f2=${f2?.id} lines=${JSON.stringify(f2?.lines)} entries=${JSON.stringify(entries2.map(e => `#${e.stockLocationId}:${e.quantity}`))}`
        : `shipErr=${shipItem2?.error}`);

    // ---- t4: 订单级共 2 个 fulfillment，行并集覆盖订单全部数量（同一行 quantity 分摊 5+3=8） ----
    const fulfs4 = await readOrderFulfillments(adminToken, order.orderId);
    const t4 = fulfs4.length === 2 &&
      fulfs4.every(f => f.lines.length === 1) &&
      fulfs4.every(f => String(f.lines[0].orderLineId) === String(lineId)) &&
      fulfs4.reduce((s, f) => s + f.lines[0].quantity, 0) === ORDER_QTY;
    result("t4.订单共 2 个 fulfillment，行并集覆盖订单全部数量", t4,
      fulfs4.length ? JSON.stringify(fulfs4.map(f => `#${f.id}:pkg=${f.customFields?.packageId}:lines=${JSON.stringify(f.lines)}`)) : "无 fulfillment");

    // ---- t5: 非拆单订单不带 packageId 发货 → 整单降级兼容 ----
    const order5 = await placeOrderAsCustomer({ email: "pkg8b@example.com", password: "Test@123", firstName: "阶段8", lastName: "客户B" }, v.id, 3, { lat: 43.85, lng: 125.42 });
    orders.push({ token: order5.token, orderId: order5.orderId });
    // 不下 splitPlan，直接发货（无 packageId）
    const ship5 = await adminGql(
      `mutation($items: [BatchFulfillmentItem!]!){ batchCreateFulfillment(items: $items){ items { orderId success trackId error } } }`,
      { items: [{ orderId: order5.orderId, trackingNo: `SF8B${Date.now()}`, carrierCode: SPLIT_CARRIER }] },
      adminToken,
    );
    const shipItem5 = ship5.data?.batchCreateFulfillment?.items?.[0];
    const t5 = shipItem5?.success === true;
    result("t5.非拆单整单发货（降级兼容）", t5, shipItem5?.error ?? `trackId=${shipItem5?.trackId}`);
  } catch (e) {
    result("执行异常", false, e?.message ?? String(e));
  } finally {
    // 清理：取消测试单
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
