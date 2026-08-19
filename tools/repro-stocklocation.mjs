#!/usr/bin/env node
// 最小复现：创建单个上门配送订单 → 分配 → 检查 orderLine.customFields.stockLocationId
const SHOP = "http://127.0.0.1:3000/shop-api";
const ADMIN = "http://127.0.0.1:3000/admin-api";
const CHANNEL_TOKEN = "abc123xyz";
const CITY = "长春市";
const COORDS = { lat: 43.8256, lng: 125.3235 };

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

(async () => {
  let r = await adminGql(`mutation{login(username:"superadmin",password:"superadmin"){... on CurrentUser{identifier}}}`);
  const at = r.data.__authToken;
  console.log("admin token ok");

  // 找一个有库存的变体
  r = await adminGql(`query { productVariants(options: { take: 1 }) { items { id name } } }`, {}, at);
  const variantId = r.data?.productVariants?.items?.[0]?.id;
  console.log("variantId:", variantId);

  const email = `repro-${Date.now()}@example.com`;
  let token = "";
  r = await shopGql(`mutation($id: ID!, $q: Int!){ addItemToOrder(productVariantId: $id, quantity: $q){ ... on Order { id code state totalWithTax lines { id quantity } } ... on ErrorResult { message } } }`, { id: variantId, q: 1 }, token);
  token = r.data?.__sessionToken || token;
  const order0 = r.data?.addItemToOrder;
  if (order0?.__typename === "ErrorResult") throw new Error("加购失败: " + JSON.stringify(order0));
  const lineId = order0?.lines?.[0]?.id;
  const orderId = order0?.id;
  console.log("order:", orderId, "line:", lineId, "state:", order0?.state);

  r = await shopGql(`mutation{ setOrderCustomFields(input: { customFields: { lat: ${COORDS.lat}, lng: ${COORDS.lng}, city: "${CITY}", deliveryType: "delivery" } }){ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  r = await shopGql(`mutation{ setOrderShippingAddress(input: { fullName: "复现测试", streetLine1: "自由大路 100 号", city: "${CITY}", countryCode: "CN" }){ ... on Order { id } ... on ErrorResult { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  r = await shopGql(`mutation{ setCustomerForOrder(input: { emailAddress: "${email}", firstName: "复现", lastName: "测试" }){ ... on Order { id state } ... on ErrorResult { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  r = await shopGql(`query { eligibleShippingMethods { id code name } }`, {}, token);
  token = r.data?.__sessionToken || token;
  const methods = r.data?.eligibleShippingMethods || [];
  if (!methods.length) throw new Error("无可用配送方式");
  r = await shopGql(`mutation($id: ID!){ setOrderShippingMethod(shippingMethodId: [$id]){ ... on Order { id state } ... on ErrorResult { message } } }`, { id: methods[0].id }, token);
  token = r.data?.__sessionToken || token;
  r = await shopGql(`mutation{ transitionOrderToState(state: "ArrangingPayment"){ ... on Order { id code state } ... on OrderStateTransitionError { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  console.log("after ArrangingPayment:", r.data?.transitionOrderToState?.state);

  // 查订单行 stockLocationId
  r = await adminGql(`query($id: ID!){ order(id: $id){ id code state lines { id quantity customFields { stockLocationId } } } }`, { id: orderId }, at);
  console.log("order detail:", JSON.stringify(r.data?.order, null, 1));
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
