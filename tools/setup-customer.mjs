// 在线上默认渠道注册可登录的 C 端测试客户（native 密码登录），供 D1 截图使用。
const SHOP_API = "https://www.youshop.cn/shop-api";
const CH = "cnx87ezvmjx8nn3bth6c";
const EMAIL = "e2e-coupon@joho.cn";
const PASS = "Test#Coupon123";

async function gql(url, q, v, headers = {}, method = "POST") {
  const r = await fetch(url, {
    method, headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ query: q, variables: v || {} }),
  });
  return { token: r.headers.get("vendure-auth-token") || "", body: await r.json() };
}

const res = await gql(SHOP_API, `mutation($i:RegisterCustomerInput!){
  registerCustomerAccount(input:$i){ __typename }
}`, {
  i: { emailAddress: EMAIL, password: PASS, firstName: "E2E券", lastName: "测试" },
}, { "vendure-channel-token": CH });

console.log("register:", JSON.stringify(res.body, null, 2));

// 验证 shop-api 可登录
const login = await gql(SHOP_API, "mutation($u:String!,$p:String!){ login(username:$u,password:$p){ __typename } }", { u: EMAIL, p: PASS }, { "vendure-channel-token": CH });
console.log("shop login token:", login.token ? "OK" : "FAIL");
if (login.token) console.log(login.token);
else console.log(JSON.stringify(login.body));
