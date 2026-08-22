#!/usr/bin/env node
// 阶段43「发票自助 + 电子发票」端到端验证
// 覆盖：发票抬头管理(建/列/设默认/删除) + C端申请发票 → 后台 issue(生成PDF) → pdfUrl 生成 →
//      C端 downloadInvoicePdf 可取到 URL + PDF 可下载。
// 前置(dev server 运行中)：shop-a 渠道；双仓 Default(1)、二道区仓(2)；NF-WATER-500 两仓有库存；
//     dummy-payment 支付方式挂载 shop-a（automaticSettle=false → admin settlePayment）。
// 订单需到达 Delivered 才能开票（InvoiceService 仅允许 Delivered/Completed/PartialDelivery），
// 故复用阶段10 履约闭环 helper 把订单推到 Delivered。
// 用法: node tools/e2e-invoice.mjs [shop-api] [admin-api]
// 退出码: 0=通过 1=存在FAIL
const SHOP = process.argv[2] || "http://127.0.0.1:3000/shop-api";
const ADMIN = process.argv[3] || "http://127.0.0.1:3000/admin-api";
const CHANNEL_TOKEN = "shop-a-token";
const VARIANT_SKU = "NF-WATER-500";
const LOC_PRIORITY = "2";
const LOC_DEFAULT = "1";
const NEAR_ANCHOR = { lat: 43.8502, lng: 125.4232 };
const ORDER_QTY = 2;
const SPLIT_SHIPPING_CODE = "split-package-shipping-method";
const SHOP_A_CHANNEL_ID = "2";
const PACKAGE_RULES = JSON.stringify([
  { locationId: LOC_DEFAULT, baseFee: 800, perKmFee: 150, freeThreshold: 0 },
  { locationId: LOC_PRIORITY, baseFee: 1000, perKmFee: 200, freeThreshold: 0 },
]);

let passed = 0, failed = 0;
function result(name, ok, detail) {
  const tag = ok === true ? "PASS" : "FAIL";
  if (ok === true) passed++; else failed++;
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
    `mutation($id: ID!, $cf: UpdateChannelCustomFieldsInput!){ updateChannel(input: { id: $id, customFields: $cf }){ ... on Channel { id } } }`,
    { id: SHOP_A_CHANNEL_ID, cf }, token,
  );
  return r.data?.updateChannel;
}
async function setVariantStock(token, variantId, locationId, stockOnHand) {
  const r = await adminGql(
    `mutation{ setVariantStock(productVariantId: ${JSON.stringify(variantId)}, stockLocationId: ${JSON.stringify(locationId)}, stockOnHand: ${stockOnHand}) }`,
    {}, token,
  );
  return r.data?.setVariantStock === true;
}
async function resetTwoLocStock(token, variantId, targetAvail) {
  const pl = await adminGql(`query{ products(options:{ take: 100 }){ items{ variants{ id sku stockLevels{ stockOnHand stockAllocated stockLocationId } } } } }`, {}, token);
  const v = pl.data?.products?.items?.flatMap(x => x.variants || []).find(x => x.sku === VARIANT_SKU);
  if (!v) return false;
  for (const locId of [LOC_DEFAULT, LOC_PRIORITY]) {
    const lv = (v.stockLevels || []).find(l => String(l.stockLocationId) === String(locId));
    const onHand = targetAvail + (lv?.stockAllocated ?? 0);
    await setVariantStock(token, v.id, locId, onHand);
  }
  return true;
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
    { input: { shippingMethodIds: [String(method.id)], channelId: SHOP_A_CHANNEL_ID } }, token,
  );
  return method;
}
async function ensureCustomer(c) {
  await shopGql(`mutation($i: RegisterCustomerInput!){ registerCustomerAccount(input: $i){ ... on Success { success } ... on ErrorResult { message } } }`, { i: { emailAddress: c.email, firstName: c.firstName, lastName: c.lastName, password: c.password, phoneNumber: c.phoneNumber } }).catch(() => {});
}
async function customerLogin(c) {
  const r = await shopGql(`mutation($e: String!, $pw: String!){ login(username: $e, password: $pw){ ... on CurrentUser { id } ... on InvalidCredentialsError { message } } }`, { e: c.email, pw: c.password });
  return { token: r.data?.__sessionToken || "", id: r.data?.login?.id };
}
async function placeOrderAsCustomer(c, variantId, qty, coords) {
  const cust = await customerLogin(c);
  let token = cust.token;
  let ar = await shopGql(`query { activeOrder { id state } }`, {}, token);
  token = ar.data?.__sessionToken || token;
  let ao = ar.data?.activeOrder;
  if (ao?.id && ao.state !== "AddingItems") {
    await shopGql(`mutation{ transitionOrderToState(state: "Cancelled"){ ... on Order { id state } ... on OrderStateTransitionError { message } } }`, {}, token);
    const ar2 = await shopGql(`query { activeOrder { id state } }`, {}, token);
    token = ar2.data?.__sessionToken || token;
    ao = ar2.data?.activeOrder;
  }
  if (ao?.id) {
    const r = await shopGql(`mutation{ removeAllOrderLines{ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
    token = r.data?.__sessionToken || token;
  }
  let r = await shopGql(`mutation($id: ID!, $q: Int!){ addItemToOrder(productVariantId: $id, quantity: $q){ ... on Order { id code state } ... on ErrorResult { message } } }`, { id: variantId, q: qty }, token);
  token = r.data?.__sessionToken || token;
  const o = r.data?.addItemToOrder;
  if (!o?.id) throw new Error(`addItemToOrder 失败: ${JSON.stringify(o)}`);
  await shopGql(`mutation{ setOrderCustomFields(input: { customFields: { lat: ${coords.lat}, lng: ${coords.lng} } }){ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
  await shopGql(`mutation{ setOrderShippingAddress(input: { fullName: "发票验证", streetLine1: "测试街道1号", city: "长春市", countryCode: "CN" }){ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
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
async function payAndSettle(shopToken, adminToken, orderId) {
  let r = await shopGql(`query { eligiblePaymentMethods { code } }`, {}, shopToken);
  const pay = (r.data?.eligiblePaymentMethods || [])[0];
  if (!pay) throw new Error("无可用支付方式");
  r = await shopGql(`mutation($code: String!){ addPaymentToOrder(input: { method: $code, metadata: {} }){ ... on Order { id state } ... on ErrorResult { message } } }`, { code: pay.code }, shopToken);
  const o = r.data?.addPaymentToOrder;
  if (!o?.id || o.__typename === "ErrorResult") throw new Error(`addPaymentToOrder 失败: ${JSON.stringify(o)}`);
  const pm = await adminGql(`query($id: ID!){ order(id: $id){ payments { id state } } }`, { id: orderId }, adminToken);
  const payments = pm.data?.order?.payments || [];
  const paymentId = payments.find(p => p.state === "Authorized")?.id || payments.find(p => p.state === "Settled")?.id;
  if (!paymentId) throw new Error("未找到 Authorized/Settled 支付");
  const sr = await adminGql(`mutation($id: ID!){ settlePayment(id: $id){ ... on Payment { id state } } }`, { id: paymentId }, adminToken);
  const aft = await adminGql(`query($id: ID!){ order(id: $id){ state } }`, { id: orderId }, adminToken);
  return { settled: sr.data?.settlePayment?.state, state: aft.data?.order?.state };
}
async function confirmSplitPlan(token, orderId, packages) {
  const r = await adminGql(
    `mutation($orderId: ID!, $packages: [SplitPackageInput!]!){ confirmSplitPlan(orderId: $orderId, packages: $packages){ orderId packages { packageId } } }`,
    { orderId, packages }, token,
  );
  return r.data?.confirmSplitPlan;
}
async function shipOrder(token, orderId, trackingNo) {
  const r = await adminGql(
    `mutation($items: [BatchFulfillmentItem!]!){ batchCreateFulfillment(items: $items){ items { orderId success trackId error } } }`,
    { items: [{ orderId, trackingNo, carrierCode: "SF", packageId: "P1", shippingFee: 1000 }] }, token,
  );
  return r.data?.batchCreateFulfillment?.items?.[0];
}
async function orderPackages(token, orderId) {
  const r = await adminGql(`query($orderId: ID!){ orderPackages(orderId: $orderId){ code status } }`, { orderId }, token);
  return r.data?.orderPackages || [];
}
async function markDelivered(token, orderId) {
  const r = await adminGql(`mutation($orderId: ID!, $packageId: String!){ markPackageDelivered(orderId: $orderId, packageId: $packageId) }`, { orderId, packageId: "P1" }, token);
  return r.data?.markPackageDelivered;
}
async function readOrder(token, orderId) {
  const r = await adminGql(`query($id: ID!){ order(id: $id){ id state } }`, { id: orderId }, token);
  return r.data?.order;
}

(async () => {
  console.log(`== 阶段43 发票自助 + 电子发票 e2e == SHOP=${SHOP} ADMIN=${ADMIN}`);
  const adminToken = await adminLogin();
  if (!adminToken) { console.log("Admin 登录失败"); process.exit(1); }

  // ---- 0. 前置：variant + 双仓库存 + 拆单配送方式 ----
  const pl = await adminGql(`query{ products(options:{ take: 100 }){ items{ variants{ id sku } } } }`, {}, adminToken);
  const variant = pl.data?.products?.items?.flatMap(x => x.variants || []).find(v => v.sku === VARIANT_SKU);
  if (!variant) { result("前置.找到多仓商品", false, `未找到 ${VARIANT_SKU}`); process.exit(1); }
  const TARGET = 5;
  result("前置.双仓库存重置", await resetTwoLocStock(adminToken, variant.id, TARGET), "");
  await setChannelCustomFields(adminToken, { shippingStrategy: "nearest", stockLocationPriority: JSON.stringify([{ locationId: "1", priority: 1 }, { locationId: "2", priority: 2 }]), packageShippingRule: PACKAGE_RULES });
  const splitMethod = await ensureSplitShippingMethod(adminToken);
  result("前置.拆单配送方式就绪", !!splitMethod, splitMethod ? splitMethod.code : "");

  // ---- 1. 客户注册 + 下单支付 + 送达→Delivered（可开票状态）----
  const uniq = Date.now();
  const cust = { email: `inv43-${uniq}@example.com`, password: "Test@123", firstName: "发票", lastName: "验证", phoneNumber: `139${String(uniq).slice(-8)}` };
  await ensureCustomer(cust);
  const order = await placeOrderAsCustomer(cust, variant.id, ORDER_QTY, NEAR_ANCHOR);
  result("下单进入 ArrangingPayment", !!order.orderId, `order=${order.orderId} code=${order.code}`);
  const o1 = await readOrder(adminToken, order.orderId);
  const lineId = o1?.lines?.[0]?.id;
  const readOrderDb = async () => (await adminGql(`query($id: ID!){ order(id: $id){ lines { id quantity } } }`, { id: order.orderId }, adminToken)).data?.order;
  const od = await readOrderDb();
  const lineId2 = od?.lines?.[0]?.id;
  const plan = await confirmSplitPlan(adminToken, order.orderId, [{ stockLocationId: LOC_PRIORITY, lines: [{ orderLineId: lineId2 || lineId, quantity: ORDER_QTY }] }]);
  result("confirmSplitPlan 生成单包裹 P1", !!plan && plan.packages?.some(p => p.packageId === "P1"), JSON.stringify(plan?.packages || []));
  const ps = await payAndSettle(order.token, adminToken, order.orderId);
  const shipItem = await shipOrder(adminToken, order.orderId, `SF43${uniq}`);
  result("包裹发货 P1 → shipped", shipItem?.success === true, shipItem?.error || JSON.stringify(shipItem));
  const delivered = await markDelivered(adminToken, order.orderId);
  const odFinal = await readOrder(adminToken, order.orderId);
  result("送达 → 订单 Delivered", delivered === true && odFinal?.state === "Delivered", `order=${odFinal?.state} markDelivered=${delivered}`);

  // ---- 2. 抬头管理 ----
  const custLogin = await customerLogin(cust);
  const ctoken = custLogin.token;
  result("C端客户登录", !!ctoken, `id=${custLogin.id}`);

  const title = await shopGql(`mutation($i: CreateInvoiceTitleInput!){ createInvoiceTitle(input: $i){ id title taxNumber isDefault } }`, { i: { title: "北京云端科技有限公司", taxNumber: "91110108MA01ABCDEF", email: "tax@cloud.dev", companyAddress: "北京市海淀区", isDefault: true } }, ctoken);
  const t1 = title.data?.createInvoiceTitle;
  result("建抬头(默认)", !!t1?.id && t1.isDefault === true, JSON.stringify(t1));

  const title2 = await shopGql(`mutation($i: CreateInvoiceTitleInput!){ createInvoiceTitle(input: $i){ id title isDefault } }`, { i: { title: "个人抬头", isDefault: false } }, ctoken);
  const t2 = title2.data?.createInvoiceTitle;
  result("建第2抬头(非默认)", !!t2?.id && t2.isDefault === false, JSON.stringify(t2));

  const setDef = await shopGql(`mutation($id: ID!){ setDefaultInvoiceTitle(id: $id){ id isDefault } }`, { id: t2.id }, ctoken);
  result("设默认 → 唯一默认", setDef.data?.setDefaultInvoiceTitle?.isDefault === true, JSON.stringify(setDef.data?.setDefaultInvoiceTitle));

  const listAfter = await shopGql(`query { myInvoiceTitles { id title isDefault } }`, {}, ctoken);
  const t1After = listAfter.data?.myInvoiceTitles?.find(t => String(t.id) === String(t1.id));
  const t2After = listAfter.data?.myInvoiceTitles?.find(t => String(t.id) === String(t2.id));
  result("设默认后全局唯一(旧默认被清)", listAfter.data?.myInvoiceTitles?.filter(x => x.isDefault).length === 1 && t1After?.isDefault === false && t2After?.isDefault === true, JSON.stringify(listAfter.data?.myInvoiceTitles));

  // ---- 3. 申请发票 → 后台 issue → PDF ----
  const inv = await shopGql(`mutation($i: CreateInvoiceInput!){ createInvoice(input: $i){ id status title orderIds invoiceType } }`, { i: { orderIds: [order.orderId], invoiceType: "ordinary", title: "北京云端科技有限公司", taxNumber: "91110108MA01ABCDEF", email: "tax@cloud.dev" } }, ctoken);
  const invoice = inv.data?.createInvoice;
  result("C端申请发票(PENDING)", !!invoice?.id && invoice.status === "pending", JSON.stringify(invoice));
  if (!invoice?.id) { console.log("[err]", JSON.stringify(inv.body?.errors)); process.exit(1); }

  const issued = await adminGql(`mutation($id: ID!){ issueInvoice(id: $id){ id status pdfUrl providerInvoiceNo } }`, { id: invoice.id }, adminToken);
  const i1 = issued.data?.issueInvoice;
  result("后台 issueInvoice → ISSUED + pdfUrl 生成", i1?.status === "issued" && !!i1?.pdfUrl, `status=${i1?.status} pdfUrl=${i1?.pdfUrl} invNo=${i1?.providerInvoiceNo}`);
  if (!i1?.pdfUrl) { console.log("[err]", JSON.stringify(i1 || issued.body?.errors)); process.exit(1); }

  // 下载服役：可直接取回 URL（幂等，不再重新生成）
  const dl = await shopGql(`mutation($id: ID!){ downloadInvoicePdf(id: $id){ id status pdfUrl } }`, { id: invoice.id }, ctoken);
  const d1 = dl.data?.downloadInvoicePdf;
  result("C端 downloadInvoicePdf → pdfUrl 可取", d1?.status === "issued" && !!d1?.pdfUrl, `pdfUrl=${d1?.pdfUrl}`);

  // PDF 真实可下载(HTTP 200 且为 application/pdf 或含 %PDF)
  const pdfUrl = d1?.pdfUrl || i1?.pdfUrl;
  let pdfOk = false, mime = "";
  try {
    const abs = pdfUrl.startsWith("http") ? pdfUrl : (SHOP.replace("/shop-api", "") + "/" + pdfUrl);
    const pr = await fetch(abs);
    const ct = pr.headers.get("content-type") || "";
    const buf = Buffer.from(await pr.arrayBuffer());
    mime = ct;
    pdfOk = pr.status === 200 && (ct.includes("pdf") || buf.slice(0, 4).toString("latin1") === "%PDF");
  } catch { pdfOk = false; }
  result("PDF 可下载(HTTP200 + 内容为PDF)", pdfOk, `ct=${mime} url=${pdfUrl}`);

  // ---- 4. 冲红 ----
  const rev = await adminGql(`mutation($id: ID!, $r: String!){ reverseInvoice(id: $id, reason: $r){ id status } }`, { id: invoice.id, r: "测试冲红" }, adminToken);
  result("后台 reverseInvoice → REVERSED", rev.data?.reverseInvoice?.status === "reversed", JSON.stringify(rev.data?.reverseInvoice));

  // ---- 5. 删除抬头 ----
  const delT2 = await shopGql(`mutation($id: ID!){ deleteInvoiceTitle(id: $id) }`, { id: t2.id }, ctoken);
  const listFinal = await shopGql(`query { myInvoiceTitles { id } }`, {}, ctoken);
  const remain = listFinal.data?.myInvoiceTitles?.filter(t => String(t.id) === String(t2.id)).length;
  result("删除抬头生效", delT2.data?.deleteInvoiceTitle === true && remain === 0, `delete=${delT2.data?.deleteInvoiceTitle} remain=${remain}`);

  console.log(`\n== 结果: ${passed} 通过, ${failed} 失败 ==`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });