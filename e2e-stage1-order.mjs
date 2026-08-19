#!/usr/bin/env node
// 阶段1端到端验证：生产 Shop API 走完整下单流程 -> ArrangingPayment 触发就近库存分配
// 用法: node e2e-stage1-order.mjs [shopApiUrl] [adminApiUrl] [lat] [lng] [city]
const SHOP = process.argv[2] || "http://127.0.0.1:13020/shop-api";
const ADMIN = process.argv[3] || "http://127.0.0.1:13020/admin-api";
const CHANNEL_TOKEN = "abc123xyz";
const CITY = process.argv[6] || "长春市";
const ORDER_LOC = {
  lat: process.argv[4] ? parseFloat(process.argv[4]) : 43.8256,
  lng: process.argv[5] ? parseFloat(process.argv[5]) : 125.3235,
}; // 默认与长春门店坐标一致，验证就近命中；可传远距离坐标验证 fallback

// Shop API 请求（带会话 token 往返）
async function shopGql(query, variables = {}, token = "") {
  const headers = { "Content-Type": "application/json", "vendure-channel-token": CHANNEL_TOKEN };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(SHOP, { method: "POST", headers, body: JSON.stringify({ query, variables }) });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { return { http: res.status, raw: text.slice(0, 300), data: null }; }
  const h = res.headers.get("vendure-auth-token");
  if (h && body.data) body.data.__sessionToken = h;
  if (body.errors) console.log("[shop-err]", JSON.stringify(body.errors.map(e => e.message)));
  return body;
}

// Admin API 请求
async function adminGql(query, variables = {}, token = "") {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(ADMIN, { method: "POST", headers, body: JSON.stringify({ query, variables }) });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { return { http: res.status, raw: text.slice(0, 300), data: null }; }
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
    if (r.data?.__authToken) { console.log("[admin] LOGIN_OK", u); return r.data.__authToken; }
  }
  throw new Error("Admin 登录失败");
}

(async () => {
  // 0. 找一个商品 variant（shop stockLevel 为枚举，不作数值过滤）
  const list = await shopGql(`query($opts: ProductListOptions){ products(options:$opts){ totalItems items { id name variants { id sku name } } } }`, { opts: { take: 50 } });
  if (list.errors) throw new Error("查询商品失败: " + JSON.stringify(list.errors));
  const items = list.data?.products?.items || [];
  console.log("[shop] 商品数:", list.data?.products?.totalItems);
  const variant = items.flatMap(p => (p.variants || []).map(v => ({ ...v, productName: p.name })))[0];
  if (!variant) throw new Error("无商品可下单");
  console.log("[shop] 选择商品:", variant.productName, "| variantId:", variant.id, "| sku:", variant.sku);

  // 1. 开启匿名会话
  let token = "";
  const active0 = await shopGql(`query { activeOrder { id code state } }`);
  token = active0.data?.__sessionToken || "";

  // 2. 加购
  let r = await shopGql(`mutation($id: ID!, $q: Int!){ addItemToOrder(productVariantId: $id, quantity: $q){ ... on Order { id code state totalWithTax } ... on ErrorResult { message } } }`, { id: variant.id, q: 1 }, token);
  token = r.data?.__sessionToken || token;
  const order0 = r.data?.addItemToOrder;
  if (!order0 || order0.__typename === "ErrorResult") throw new Error("加购失败: " + JSON.stringify(r.data?.addItemToOrder));
  console.log("[shop] 加购成功 -> 订单:", order0.code, "| 状态:", order0.state);

  // 3. 写入订单定位自定义字段（模拟前端 syncOrderLocation）
  r = await shopGql(
    `mutation{ setOrderCustomFields(input: { customFields: { lat: ${ORDER_LOC.lat}, lng: ${ORDER_LOC.lng}, city: "${CITY}", deliveryType: "home-delivery" } }){ ... on Order { id customFields { lat lng city deliveryType } } ... on ErrorResult { message } } }`,
    {}, token,
  );
  token = r.data?.__sessionToken || token;
  const setCf = r.data?.setOrderCustomFields;
  console.log("[shop] 写入定位字段:", JSON.stringify(setCf?.customFields || setCf));

  // 4. 设置收货地址
  r = await shopGql(`mutation{ setOrderShippingAddress(input: { fullName: "测试用户", streetLine1: "朝阳区自由大路 100 号", city: "${CITY}", countryCode: "CN" }){ ... on Order { id code state } ... on ErrorResult { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  console.log("[shop] 设置收货地址 ->", r.data?.setOrderShippingAddress?.state || JSON.stringify(r.data?.setOrderShippingAddress));

  // 4b. 设置客户信息（Vendure 前置条件：转 ArrangingPayment 前必须有客户）
  r = await shopGql(`mutation{ setCustomerForOrder(input: { emailAddress: "e2e-stage1@example.com", firstName: "测试", lastName: "用户" }){ ... on Order { id code state } ... on ErrorResult { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  console.log("[shop] 设置客户 ->", r.data?.setCustomerForOrder?.state || JSON.stringify(r.data?.setCustomerForOrder));

  // 5. 选配送方式
  r = await shopGql(`query { eligibleShippingMethods { id code name priceWithTax } }`, {}, token);
  token = r.data?.__sessionToken || token;
  const methods = r.data?.eligibleShippingMethods || [];
  console.log("[shop] 可用配送方式:", methods.map(m => `${m.code}:${m.priceWithTax}`).join(", ") || "无");
  if (methods.length === 0) throw new Error("无可用配送方式");
  r = await shopGql(`mutation($id: ID!){ setOrderShippingMethod(shippingMethodId: [$id]){ ... on Order { id state } ... on ErrorResult { message } } }`, { id: methods[0].id }, token);
  token = r.data?.__sessionToken || token;
  console.log("[shop] 选择配送方式:", methods[0].code, "->", r.data?.setOrderShippingMethod?.state || JSON.stringify(r.data?.setOrderShippingMethod));

  // 6. 转入 ArrangingPayment（触发库存分配）
  r = await shopGql(`mutation{ transitionOrderToState(state: "ArrangingPayment"){ ... on Order { id code state } ... on OrderStateTransitionError { message } } }`, {}, token);
  token = r.data?.__sessionToken || token;
  const finalState = r.data?.transitionOrderToState?.state;
  console.log("[shop] 转入 ArrangingPayment ->", finalState || JSON.stringify(r.data?.transitionOrderToState));
  const orderId = r.data?.transitionOrderToState?.id || order0.id;
  const orderCode = r.data?.transitionOrderToState?.code || order0.code;

  // 7. Admin 核对订单状态与定位字段（分配结果走 DB 核对）
  const adminToken = await adminLogin();
  const a = await adminGql(`query($id: ID!){ order(id: $id){ id code state customFields { lat lng city deliveryType } lines { id productVariant { name } quantity orderPlacedQuantity } } }`, { id: orderId }, adminToken);
  if (a.errors) console.log("[admin] 查询错误:", JSON.stringify(a.errors));
  const order = a.data?.order;
  console.log("\n==== 订单核对 ====");
  console.log(JSON.stringify(order, null, 1));
  const loc = order?.customFields;
  console.log(`\n订单 ${orderCode} (id=${orderId}) 状态=${order?.state}`);
  console.log("定位字段:", JSON.stringify(loc));
  const locOk = loc?.city === CITY && loc?.lat != null && loc?.lng != null;
  console.log(locOk ? "✅ 定位字段已正确写入" : "⚠️ 定位字段缺失或不对");
  console.log(`\n下一步: 用 DB 核对 allocation 表 (订单 code=${orderCode}) 确认 stock_location_id=1 (长春仓)`);
})().catch((e) => { console.log("ERR:", e.message); process.exit(1); });
