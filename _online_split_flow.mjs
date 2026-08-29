// 线上拆单方案 B 端到端验证：非余额支付 → 按箱全拆为多个独立订单
// 认证方式：Authorization: Bearer <token>（服务端响应头 vendure-auth-token 携带最新 token）
const base = "https://e.joho.cn";
let token = null;
async function gql(query, vars) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;
  const r = await fetch(base + "/shop-api", { method: "POST", headers, body: JSON.stringify({ query, variables: vars || {} }) });
  const nt = r.headers.get("vendure-auth-token");
  if (nt) token = nt;
  const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { j = { raw: txt }; }
  return j;
}
(async () => {
  const email = "split_" + Date.now() + "@test.com";
  const pwd = "z123123!";

  await gql(`mutation($i:RegisterCustomerInput!){ registerCustomerAccount(input:$i){ __typename } }`, { i: { emailAddress: email, password: pwd } });
  const lg = await gql(`mutation{ login(username:"${email}", password:"${pwd}", rememberMe:true){ __typename ...on CurrentUser{ id } ...on ErrorResult{ errorCode message } } }`);
  console.log("login:", lg?.data?.login?.__typename, "token:", token ? "SET" : "NONE");

  const a1 = await gql(`mutation($v:ID!,$q:Int!){ addItemToOrder(productVariantId:$v quantity:$q){ __typename ...on Order{ id code total lines{ id quantity productVariant{ id sku } } } ...on ErrorResult{ errorCode message } } }`, { v: "6", q: 1 });
  console.log("add var6 :", JSON.stringify(a1?.data?.addItemToOrder?.code || a1?.data?.addItemToOrder || a1?.errors));
  const a2 = await gql(`mutation($v:ID!,$q:Int!){ addItemToOrder(productVariantId:$v quantity:$q){ __typename ...on Order{ id code total lines{ id quantity productVariant{ id sku } } } ...on ErrorResult{ errorCode message } } }`, { v: "31", q: 1 });
  console.log("add var31:", JSON.stringify(a2?.data?.addItemToOrder?.code || a2?.data?.addItemToOrder || a2?.errors));

  const setAddr = await gql(`mutation($i:CreateAddressInput!){ setOrderShippingAddress(input:$i){ __typename ...on Order{ id } ...on ErrorResult{ errorCode message } } }`, { i: { fullName: "测试", streetLine1: "测试路1号", city: "上海", province: "上海市", postalCode: "200000", countryCode: "CN", phoneNumber: "13800138000" } });
  console.log("setAddr:", setAddr?.data?.setOrderShippingAddress?.__typename || JSON.stringify(setAddr?.errors));

  const boxes = await gql(`{ orderBoxes { boxKey profileId profileName lineIds availableShippingMethodIds defaultShippingMethodId availablePaymentMethodCodes } }`);
  console.log("orderBoxes:", JSON.stringify(boxes?.data?.orderBoxes || boxes?.errors));

  // 选非余额方式（取某箱白名单里非 balance-wallet 的第一个）
  const boxList = boxes?.data?.orderBoxes || [];
  const allCodes = [...new Set((boxList || []).flatMap(b => b.availablePaymentMethodCodes || []))];
  const nonBalance = allCodes.find(c => c !== "balance-wallet");
  console.log("availableCodes:", allCodes, "-> chosen non-balance method:", nonBalance);
  if (!nonBalance) { console.log("!! 未找到非余额支付方式，无法验证方案 B"); return; }

  const settled = await gql(`mutation($m:String!){ checkoutSplitted(method:$m){ __typename ...on Order{ id code total state lines{ id quantity productVariant{ sku } } } } }`, { m: nonBalance });
  console.log("checkoutSplitted:", JSON.stringify(settled?.data?.checkoutSplitted || settled?.errors));

  const orders = settled?.data?.checkoutSplitted || [];
  const cnt = Array.isArray(orders) ? orders.length : 0;
  console.log(`\n====> 方案B结果：返回 ${cnt} 个订单 ${cnt === 2 ? '✅ 符合预期（2箱分别拆单）' : '⚠️ 不符合预期'}`);
})().catch(e => console.error("ERR", e.message));