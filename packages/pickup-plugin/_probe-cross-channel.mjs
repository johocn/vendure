/* cross-channel e2e: 商城渠道顾客下到店自提 COD 单 → 商户(t1) myShopOrders 可见 + 防漏收核销
 * 顾客(商城 cnx87ez): split-e2e-a@joho.cn ; 商户收银(t1 a6fn): zhao@163.com */
const ADMIN='https://e.joho.cn/admin-api';
const SHOP='https://www.youshop.cn/shop-api';
const BUYER={email:'split-e2e-a@joho.cn',password:'Test#Split123'};
const CASHIER={email:'zhao@163.com',password:'23123'};
const MALL_CH='cnx87ezvmjx8nn3bth6c'; // 默认商城渠道
const VARIANT_PICKUP=48, SHIP='1', PICKUP_LOC='1', PICKUP_TYPE='store';

async function gql(url,q,v={},auth,ch){const h={'Content-Type':'application/json'};if(auth)h.Authorization='Bearer '+auth;if(ch)h['vendure-token']=ch;const res=await fetch(url,{method:'POST',headers:h,body:JSON.stringify({query:q,variables:v})});const j=await res.json();if(j.errors){const e=new Error(j.errors.map(x=>x.message).join('; '));e.d=j.data;throw e;}return j.data;}
async function login(url,u,p,ch){
  const headers={'Content-Type':'application/json',...(ch?{'vendure-token':ch}:{})};
  const body=JSON.stringify({query:`mutation($u:String!,$p:String!){login(username:$u,password:$p){...on CurrentUser{id identifier} ...on ErrorResult{message}}}`});
  const r=await fetch(url,{method:'POST',headers,body});
  const c=(await r.json()).data?.login;
  if(!c?.id) throw new Error('登录失败 '+(c?.message||JSON.stringify(c)));
  return {auth:r.headers.get('vendure-auth-token'),c};
}

(async()=>{
  // A. 商城顾客耗时自提单(COD checkoutSplitted)
  const shop=await login(SHOP,BUYER.email,BUYER.password,MALL_CH);
  console.log('[A] 商城顾客登录:',shop.c.identifier);
  try{await gql(SHOP,`mutation{ removeAllOrderLines{ ...on Order{ id } } }`,{},shop.auth,MALL_CH);}catch{}
  await gql(SHOP,`mutation($i:ID!){ addItemToOrder(productVariantId:$i,quantity:1){ ...on Order{ id } } }`,{i:String(VARIANT_PICKUP)},shop.auth,MALL_CH);
  await gql(SHOP,`mutation($i:[ID!]!){ setOrderShippingMethod(shippingMethodId:$i){ ...on Order{ id } } }`,{i:[SHIP]},shop.auth,MALL_CH);
  const loc=await gql(SHOP,`query{ pickupLocations{ items{ id name } } }`,{},shop.auth,MALL_CH);
  console.log('[A] 自提点:',(loc.pickupLocations?.items||[]).map(x=>`${x.id}:${x.name}`).join(', '));
  await gql(SHOP,`mutation($i:ID!,$t:String!){ setOrderPickupLocation(pickupLocationId:$i,pickupType:$t){ ...on Order{ id } } }`,{i:PICKUP_LOC,t:PICKUP_TYPE},shop.auth,MALL_CH);
  const dd=await gql(SHOP,`mutation($m:String!){ checkoutSplitted(method:$m){ id code state customFields{ deliveryType collected paymentType } payments{ method state } } }`,{m:'cash-on-delivery'},shop.auth,MALL_CH);
  const orders=dd.checkoutSplitted||[];
  if(!orders.length)throw new Error('checkoutSplitted 无返回: '+JSON.stringify(dd));
  const ord=orders[0];
  console.log('[A] COD 到店自提单:',ord.code,'| state=',ord.state,'| payType=',ord.customFields?.paymentType,'| method=',ord.payments?.[0]?.method);

  // B. 商户(t1) 取核销码 + myShopOrders 可见性
  const adm=await login(ADMIN,CASHIER.email,CASHIER.password); // zhao 默认 t1
  const t1='a6fn474hhiqasmyiyrfl';
  const mo=await gql(ADMIN,`query{ myShopOrders{ orderId code state customerName } }`,{},adm.auth,t1);
  const hit=(mo.myShopOrders||[]).find(o=>o.code===ord.code);
  console.log('[B] 商户 myShopOrders 命中该商城单:', hit?`YES state=${hit.state} cust=${hit.customerName}`:'NO（不可见）');
  if(!hit)throw new Error('商户未能在 t1 看到商城顾客单');

  // C. 找码并防漏收核销（claim 走 admin-api, 需含 auth+channel? 试 t1）
  const buy_pg=await gql(SHOP,`query{ orderByCode(code:"${ord.code}"){ id customFields{ deliveryType } } }`,{},shop.auth,MALL_CH);
  const orderId=buy_pg.orderByCode.id;
  // 顾客取码
  const coder=await gql(SHOP,`query{ orderRedemptionCode(input:{orderCode:"${ord.code}"}){ redemptionCode canAccess } }`,{},shop.auth,MALL_CH);
  const rc=coder.orderRedemptionCode.redemptionCode;
  const re=await gql(ADMIN,`query{ pickupRedemptions(options:{take:100}){ items{ orderId code status paymentType collected } } }`,{},adm.auth,t1);
  const mine=(re.pickupRedemptions?.items||[]).find(x=>String(x.orderId)===String(orderId));
  console.log('[C] 商城单核销码:',rc,'| 商户可见核销状态:',mine?JSON.stringify(mine):'未在 t1 pickupRedemptions');
})().catch(e=>{console.error('run error:',e.message);if(e.d)console.error('data=',JSON.stringify(e.d));process.exit(2)});