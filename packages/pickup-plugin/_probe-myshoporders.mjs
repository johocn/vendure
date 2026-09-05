/* 商户可见性: zhao(t1) 的 myShopOrders 是否返回其本店单（含商城渠道售出的商品单） */
const ADMIN='https://e.joho.cn/admin-api';
async function gql(q,v={},auth,ch){const h={'Content-Type':'application/json'};if(auth)h.Authorization='Bearer '+auth;if(ch)h['vendure-token']=ch;const r=await fetch(ADMIN,{method:'POST',headers:h,body:JSON.stringify({query:q,variables:v})});const j=await r.json();if(j.errors){const e=new Error(j.errors.map(x=>x.message).join('; '));e.d=j.data;throw e;}return j.data;}
(async()=>{
  const t1='a6fn474hhiqasmyiyrfl';
  const r=await fetch(ADMIN,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:`mutation{login(username:"zhao@163.com",password:"23123"){...on CurrentUser{id identifier}}}`})});
  const auth=r.headers.get('vendure-auth-token');
  const mo=await gql(`query{ myShopOrders{ orderId code state totalWithTax currencyCode customerName placedAt items{ orderLineId productId productName variantName quantity } } }`,{},auth,t1);
  const items=(mo.myShopOrders||[]);
  console.log('== zhao(t1) myShopOrders 本店商品单 ==');
  console.log('总数:', items.length);
  for(const o of items) console.log(`  ${o.code} | ${o.state} | ¥${(o.totalWithTax/100).toFixed(2)} | ${o.customerName??'-'} | ${o.items.map(i=>i.productName+'x'+i.quantity).join(',')}`);
})().catch(e=>{console.error('ERR',e.message);if(e.d)console.error(JSON.stringify(e.d));process.exit(2)});