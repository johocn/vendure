// D3 线上回归 v5：t2 渠道（正确渠道头 vendure-token）
// A) 结算折扣只算绑定行：购物车=绑定 variant58(含税88000) + 非绑定 variant57(含税16800)，
//    用券后折扣应=round(88000*0.85)=74800（t2 pricesIncludeTax=true，PERCENT 15→85%），非绑定行被剔除
// B) newCustomerOnly：同一账号下单后再次兑换 T2SKU08518 → 被拦截
const SHOP = "https://www.youshop.cn/shop-api";
const CH_T2 = "66ruvnhh34svhckaa2i";

let token = "";
async function gql(q, v = {}, headers = {}) {
  const r = await fetch(SHOP, { method: "POST", headers: { "Content-Type": "application/json", "vendure-token": CH_T2, ...(token ? { Authorization: "Bearer " + token } : {}), ...headers }, body: JSON.stringify({ query: q, variables: v }) });
  const t = r.headers.get("vendure-auth-token");
  if (t) token = t;
  return { token: t, body: await r.json() };
}
function data(x) { return x.body.data; }
function err(x) { return JSON.stringify(x.body?.errors ?? x.body).slice(0, 300); }

const email = `coupon-reg-${Date.now()}@joho.cn`;
let r = await gql("mutation($i:RegisterCustomerInput!){ registerCustomerAccount(input:$i){ __typename } }", { i: { emailAddress: email, password: "Test#Coupon123", firstName: "回归", lastName: "新客" } });
console.log("R1 register:", JSON.stringify(data(r)?.registerCustomerAccount ?? err(r)));
r = await gql("mutation($u:String!,$p:String!){ login(username:$u,password:$p){ __typename } }", { u: email, p: "Test#Coupon123" });
console.log("R2 login:", r.token ? "OK" : "FAIL " + err(r));

r = await gql("mutation{ removeAllOrderLines{ ...on Order{ id } } }");
console.log("R3 clear:", data(r)?.removeAllOrderLines ? "OK" : err(r));

// 购物车：绑定 variant58(77876) + 非绑定 variant57(14867)
r = await gql("mutation($i:ID!){ addItemToOrder(productVariantId:$i, quantity:1){ ...on Order{ id totalWithTax } } }", { i: "58" });
console.log("R4 add bound(58):", JSON.stringify(data(r)?.addItemToOrder));
r = await gql("mutation($i:ID!){ addItemToOrder(productVariantId:$i, quantity:1){ ...on Order{ id totalWithTax } } }", { i: "57" });
console.log("R5 add unbound(57):", JSON.stringify(data(r)?.addItemToOrder));

// 凭码兑换（T2SKU08518 = 模板9，newCustomerOnly，新客可领）
r = await gql("mutation($c:String!){ redeemCouponByCode(claimCode:$c){ code } }", { c: "T2SKU08518" });
const rc = data(r)?.redeemCouponByCode;
console.log("R6 新客兑换:", rc?.code ? "OK:" + rc.code : err(r));
if (!rc?.code) throw new Error("新客兑换应成功");
const code = rc.code;

// 用券
r = await gql("mutation($c:String!){ applyCouponToOrder(code:$c){ id totalWithTax discounts{ description amountWithTax } } }", { c: code });
const applied = data(r)?.applyCouponToOrder;
console.log("R7 applyCoupon:", applied ? JSON.stringify({ total: applied.totalWithTax, discounts: applied.discounts }) : err(r));
if (!applied) throw new Error("用券失败");
const disc = (applied.discounts ?? []).find(d => String(d.description).includes("温泉") || String(d.description).includes("专属")) ?? (applied.discounts ?? [])[0];
console.log("R8 折扣额:", disc?.amountWithTax ?? "none", "| 期望 74800");
const okA = Math.abs(disc?.amountWithTax ?? 0) === 74800;
console.log("A 结算非绑定行剔除:", okA ? "PASS" : "FAIL");
if (!okA) throw new Error("A 段失败");

// 下单产生历史订单
r = await gql("mutation($m:String!){ checkoutSplitted(method:$m){ id code state } }", { m: "cod-payment-template" });
const arr = (data(r) ?? {})?.checkoutSplitted;
console.log("R9 checkout:", Array.isArray(arr) ? `code=${arr[0]?.code} state=${arr[0]?.state}` : err(r));

// 老客再兑换 → 应抛错拦截（newCustomerOnly）
r = await gql("mutation($c:String!){ redeemCouponByCode(claimCode:$c){ code } }", { c: "T2SKU08518" });
const r10 = data(r)?.redeemCouponByCode;
console.log("R10 老客兑换:", r10 ? "OK:" + r10.code : "ERROR:" + err(r));
const okB = !r10 && JSON.stringify(r.body?.errors ?? "").includes("new customer");
console.log("B newCustomerOnly 拦截:", okB ? "PASS" : "FAIL");
if (!okB) throw new Error("B 段失败");
console.log("\nALL D3 REGRESS PASS");
