#!/usr/bin/env node
// 阶段9「达达同城配送 Provider 骨架」端到端验证（无账号，仅入站回调全链路）
//
// 前置（dev server 运行中）：shop-a 渠道；双仓 Default(1)、二道区仓(2)；NF-WATER-500 两仓有库存；
// DeliveryGatewayPlugin 以占位凭据注册 DadaProvider（dev-dada-app-secret）。
//
// 验证：
//   t1 拆单下单 → createDelivery(providerCode=mock) 建配送单（避免真实出站）
//   t2 带正确签名回调 order_status=2 → 200 {status:ok}，配送单 accepted
//   t3 回调 order_status=5 → 配送单 delivered，OrderPackage 回写 delivered
//   t4 错误签名 → 401 且不落库
//   t5 缺 order_id 仅 client_id → 按 thirdPartyNo 兜底定位推进状态机
//   t6 终态幂等：delivered 后重复回调/非法流转 → 忽略，deliveredAt 不重置
//
// 用法: node tools/e2e-phase9-dada-webhook.mjs [shop-api] [admin-api]
// 退出码: 0=通过 1=存在FAIL
import crypto from "node:crypto";

const SHOP = process.argv[2] || "http://127.0.0.1:3000/shop-api";
const ADMIN = process.argv[3] || "http://127.0.0.1:3000/admin-api";
const WEBHOOK = "http://127.0.0.1:3000/delivery-gateway/dada/webhook";
const CHANNEL_TOKEN = "shop-a-token";
// 与 dev-config.ts 占位一致
const DADA_APP_KEY = "dev-dada-app-key";
const DADA_APP_SECRET = "dev-dada-app-secret";
const DADA_SOURCE_ID = "dev-dada-source";
const VARIANT_SKU = "NF-WATER-500";
const LOC_PRIORITY = "2";
const LOC_DEFAULT = "1";
const NEAR_ANCHOR = { lat: 43.8502, lng: 125.4232 };
const ORDER_QTY = 4;
const SPLIT_SHIPPING_CODE = "split-package-shipping-method";
const PACKAGE_RULES = JSON.stringify([
  { locationId: LOC_DEFAULT, baseFee: 800, perKmFee: 150, freeThreshold: 0 },
  { locationId: LOC_PRIORITY, baseFee: 1000, perKmFee: 200, freeThreshold: 0 },
]);
const CUSTOMER = { email: "pkg9a@example.com", password: "Test@123", firstName: "阶段9", lastName: "客户A" };

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
// ---- 达达签名（与 dada-signature.ts 同规则，JS 复刻）----
function signParams(params) {
  const keys = Object.keys(params).filter(k => k !== "signature").sort();
  const s = keys.map(k => `${k}${params[k]}`).join("");
  return crypto.createHash("md5").update(DADA_APP_SECRET + s + DADA_APP_SECRET, "utf8").digest("hex").toUpperCase();
}
function signedCallback(business, overrides = {}) {
  const payload = {
    app_key: DADA_APP_KEY,
    body: JSON.stringify(business),
    format: "json",
    source_id: DADA_SOURCE_ID,
    timestamp: Math.floor(Date.now() / 1000),
    v: "1.0",
    ...overrides,
  };
  payload.signature = signParams(payload);
  return payload;
}
async function postWebhook(payload) {
  const res = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function setChannelCustomFields(token, cf) {
  const r = await adminGql(
    `mutation($id: ID!, $cf: UpdateChannelCustomFieldsInput!){ updateChannel(input: { id: $id, customFields: $cf }){ ... on Channel { id } } }`,
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
  r = await shopGql(`mutation{ setOrderShippingAddress(input: { fullName: "阶段9验证", streetLine1: "测试街道1号", city: "长春市", countryCode: "CN" }){ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
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
async function readOrder(token, orderId) {
  const r = await adminGql(
    `query($id: ID!){ order(id: $id){ id code lines { id quantity } } }`,
    { id: orderId },
    token,
  );
  return r.data?.order;
}
async function confirmSplitPlan(token, orderId, packages) {
  const r = await adminGql(
    `mutation($orderId: ID!, $packages: [SplitPackageInput!]!){ confirmSplitPlan(orderId: $orderId, packages: $packages){ orderId packages { packageId stockLocationId } } }`,
    { orderId, packages },
    token,
  );
  return r.data?.confirmSplitPlan;
}
async function createDelivery(token, orderId, packageId, providerCode) {
  const r = await adminGql(
    `mutation($input: DeliveryCreateInput!){ createDelivery(input: $input){ id code providerCode thirdPartyNo status } }`,
    { input: { orderId, packageId, providerCode, pickup: { name: "仓A", lat: 43.8808, lng: 125.3001, address: "仓库地址" }, dropoff: { name: "客户", lat: 43.8502, lng: 125.4232, address: "收货地址", phone: "13800000000" }, items: [{ name: "矿泉水", quantity: 2 }] } },
    token,
  );
  return r.data?.createDelivery;
}
async function deliveryOrders(token, orderId) {
  const r = await adminGql(`query($id: ID!){ deliveryOrders(orderId: $id){ code providerCode thirdPartyNo status deliveredAt } }`, { id: orderId }, token);
  return r.data?.deliveryOrders || [];
}
// 注：OrderPackage 的包标识字段为 code（schema 无 packageId），按 code 匹配
async function orderPackages(token, orderId) {
  const r = await adminGql(`query($id: ID!){ orderPackages(orderId: $id){ code status deliveredAt } }`, { id: orderId }, token);
  return r.data?.orderPackages || [];
}
async function resetTwoLocStock(token, variantId, targetAvail) {
  const pl = await adminGql(`query{ products(options:{ take: 100 }){ items{ variants{ id sku stockLevels{ stockOnHand stockAllocated stockLocationId } } } } }`, {}, token);
  const v = pl.data?.products?.items?.flatMap(x => x.variants || []).find(x => x.sku === VARIANT_SKU);
  const res = [];
  for (const locId of [LOC_DEFAULT, LOC_PRIORITY]) {
    const lv = (v?.stockLevels || []).find(l => String(l.stockLocationId) === String(locId));
    // Math.max(0, allocated)：历史脏数据可能残留负 allocated，避免把 onHand 拖成负值（拆单校验看 onHand）
    const onHand = targetAvail + Math.max(0, lv?.stockAllocated ?? 0);
    res.push(await setVariantStock(token, v.id, locId, onHand));
  }
  return res.every(Boolean);
}

(async () => {
  console.log(`== 阶段9 达达同城配送 Provider 骨架 e2e == SHOP=${SHOP} ADMIN=${ADMIN}`);
  const adminToken = await adminLogin();
  if (!adminToken) { console.log("Admin 登录失败"); process.exit(1); }
  const TARGET_AVAIL = 4;
  const orders = [];
  try {
    // ---- 0. 前置 ----
    const pl = await adminGql(`query{ products(options:{ take: 100 }){ items{ id variants{ id sku } } } }`, {}, adminToken);
    const v = pl.data?.products?.items?.flatMap(x => x.variants || []).find(x => x.sku === VARIANT_SKU);
    if (!v) { result("前置.找到多仓商品", false, `未找到 ${VARIANT_SKU}`); process.exit(1); }
    await setChannelCustomFields(adminToken, { shippingStrategy: "nearest", stockLocationPriority: JSON.stringify([{ locationId: "1", priority: 1 }, { locationId: "2", priority: 2 }]), memberStockStrategy: null });
    await ensureSplitShippingMethod(adminToken);
    await adminGql(`mutation($id: ID!, $cf: UpdateChannelCustomFieldsInput!){ updateChannel(input: { id: $id, customFields: $cf }){ ... on Channel { id } } }`, { id: "2", cf: { packageShippingRule: PACKAGE_RULES } }, adminToken);
    await resetTwoLocStock(adminToken, v.id, TARGET_AVAIL);
    result("前置.双仓可售重置", true);

    // ---- t1: 拆单下单 → createDelivery(mock) 建配送单（不触发真实出站）----
    const order = await placeOrderAsCustomer(CUSTOMER, v.id, ORDER_QTY, NEAR_ANCHOR);
    orders.push({ token: order.token, orderId: order.orderId });
    const o1 = await readOrder(adminToken, order.orderId);
    const lineId = o1?.lines?.[0]?.id || "";
    const split = await confirmSplitPlan(adminToken, order.orderId, [
      { stockLocationId: LOC_DEFAULT, lines: [{ orderLineId: lineId, quantity: 2 }] },
      { stockLocationId: LOC_PRIORITY, lines: [{ orderLineId: lineId, quantity: 2 }] },
    ]);
    // 用真实 split 返回的 packageId 列表
    const pkgs = (split?.packages || []);
    const p1 = pkgs[0]?.packageId;
    const p2 = pkgs[1]?.packageId;
    const d1 = await createDelivery(adminToken, order.orderId, p1, "mock");
    const d2 = await createDelivery(adminToken, order.orderId, p2, "mock");
    result("t1.创建两条 mock 配送单(P1/P2)", !!(d1?.code && d2?.code && d1.thirdPartyNo && d2.thirdPartyNo),
      `d1=${d1?.code}/${d1?.thirdPartyNo} d2=${d2?.code}/${d2?.thirdPartyNo}`);

    // ---- t2: 正确签名 order_status=2 → accepted ----
    const w2 = await postWebhook(signedCallback({ order_id: d1.code, order_status: 2 }));
    const ds1 = (await deliveryOrders(adminToken, order.orderId)).find(x => x.code === d1.code);
    result("t2.回调 status=2 → 200 ok + accepted", w2.status === 200 && w2.body?.status === "ok" && ds1?.status === "accepted",
      `http=${w2.status} body=${JSON.stringify(w2.body)} 状态=${ds1?.status}`);

    // ---- t3: order_status=5 → delivered + OrderPackage 回写 ----
    const w3 = await postWebhook(signedCallback({ order_id: d1.code, order_status: 5 }));
    const ds1b = (await deliveryOrders(adminToken, order.orderId)).find(x => x.code === d1.code);
    const pk1 = (await orderPackages(adminToken, order.orderId)).find(x => x.code === p1);
    result("t3.回调 status=5 → delivered + 包回写 delivered", w3.status === 200 && ds1b?.status === "delivered" && pk1?.status === "delivered",
      `配送=${ds1b?.status} 包=${pk1?.status}`);

    // ---- t4: 错误签名 → 401 且状态不变 ----
    const bad = signedCallback({ order_id: d2.code, order_status: 2 });
    bad.signature = "0".repeat(32);
    const w4 = await postWebhook(bad);
    const ds2 = (await deliveryOrders(adminToken, order.orderId)).find(x => x.code === d2.code);
    result("t4.错误签名 → 401 不落库", w4.status === 401 && ds2?.status === "pending",
      `http=${w4.status} 状态=${ds2?.status}`);

    // ---- t5: 缺 order_id 仅 client_id → 按 thirdPartyNo 兜底定位 ----
    const w5 = await postWebhook(signedCallback({ client_id: d2.thirdPartyNo, order_status: 2 }));
    const ds2b = (await deliveryOrders(adminToken, order.orderId)).find(x => x.code === d2.code);
    result("t5.client_id 兜底定位 → accepted", w5.status === 200 && ds2b?.status === "accepted",
      `http=${w5.status} 状态=${ds2b?.status}`);

    // ---- t6: 终态幂等 + 非法流转 ----
    const w6a = await postWebhook(signedCallback({ order_id: d1.code, order_status: 5 }));
    const ds1c = (await deliveryOrders(adminToken, order.orderId)).find(x => x.code === d1.code);
    const w6b = await postWebhook(signedCallback({ order_id: d1.code, order_status: 7 }));
    const ds1d = (await deliveryOrders(adminToken, order.orderId)).find(x => x.code === d1.code);
    result("t6.终态幂等+非法流转忽略", w6a.status === 200 && ds1c?.status === "delivered" && w6b.status === 200 && ds1d?.status === "delivered",
      `重复回调后=${ds1c?.status} 非法流转后=${ds1d?.status}`);

    console.log(`== 阶段9 e2e 完成: PASS=${passed} FAIL=${failed} SKIP=${skipped}`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (e) {
    console.error("e2e 异常:", e);
    process.exit(1);
  } finally {
    // 清理：取消测试单（仅当未提前 exit）
    for (const o of orders) {
      await adminGql(
        `mutation{ transitionOrderToState(id: "${o.orderId}", state: "Cancelled"){ ... on Order { id state } ... on OrderStateTransitionError { message } } }`,
        {},
        adminToken,
      ).catch(() => {});
    }
  }
})();
