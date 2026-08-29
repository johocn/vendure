// 线上拆单方案 A（余额合单）端到端验证：选 balance-wallet → 全部箱合并为 1 个订单
// 认证：Authorization: Bearer <token>（响应头 vendure-auth-token 携带最新 token）
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
  const email = "bal_" + Date.now() + "@test.com";
  const pwd = "z123123!";

  await gql(`mutation($i:RegisterCustomerInput!){ registerCustomerAccount(input:$i){ __typename } }`, { i: { emailAddress: email, password: pwd } });
  const lg = await gql(`mutation{ login(username:"${email}", password:"${pwd}", rememberMe:true){ __typename ...on CurrentUser{ id } ...on ErrorResult{ errorCode message } } }`);
  console.log("login:", lg?.data?.login?.__typename, "token:", token ? "SET" : "NONE");

  const a1 = await gql(`mutation($v:ID!,$q:Int!){ addItemToOrder(productVariantId:$v quantity:$q){ __typename ...on Order{ id code total lines{ id quantity productVariant{ sku } } } ...on ErrorResult{ errorCode message } } }`, { v: "6", q: 1 });
  console.log("add var6 :", JSON.stringify(a1?.data?.addItemToOrder?.code || a1?.data?.addItemToOrder || a1?.errors));
  const a2 = await gql(`mutation($v:ID!,$q:Int!){ addItemToOrder(productVariantId:$v quantity:$q){ __typename ...on Order{ id code total lines{ id quantity productVariant{ sku } } } ...on ErrorResult{ errorCode message } } }`, { v: "31", q: 1 });
  console.log("add var31:", JSON.stringify(a2?.data?.addItemToOrder?.code || a2?.data?.addItemToOrder || a2?.errors));

  await gql(`mutation($i:CreateAddressInput!){ setOrderShippingAddress(input:$i){ __typename ...on Order{ id } ...on ErrorResult{ errorCode message } } }`, { i: { fullName: "测试", streetLine1: "测试路1号", city: "上海", province: "上海市", postalCode: "200000", countryCode: "CN", phoneNumber: "13800138000" } });

  const boxes = await gql(`{ orderBoxes { boxKey profileId lineIds availablePaymentMethodCodes } }`);
  const boxList = boxes?.data?.orderBoxes || [];
  console.log("orderBoxes 箱数:", boxList.length, JSON.stringify(boxList));

  const settled = await gql(`mutation($m:String!){ checkoutSplitted(method:$m){ __typename ...on Order{ id code total state lines{ id quantity productVariant{ sku } } } } }`, { m: "balance-wallet" });
  const orders = settled?.data?.checkoutSplitted || settled?.errors;
  console.log("checkoutSplitted(balance-wallet):", JSON.stringify(orders));

  const arr = Array.isArray(orders) ? orders : [];
  const totalLines = arr.reduce((s, o) => s + (o?.lines?.length || 0), 0);
  const msg = arr.length === 1 && totalLines === 2
    ? `✅ 符合预期：${arr.length} 个订单，合并 ${totalLines} 行（2箱并入1单）`
    : `⚠️ 不符合预期：${arr.length} 个订单，合计 ${totalLines} 行`;
  console.log(`\n====> 方案A结果：` + msg);
})().catch(e => console.error("ERR", e.message));