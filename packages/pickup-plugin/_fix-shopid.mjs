/* 校正：把商品 50「中行」归属到当前店主（zhao@163.com / t1 渠道）的店铺
   通过 merchant resolver 的 addProductToMyShop（manageOwnShop 权限，店主可控，无需超管）
   同时验证 myShop 归属店铺，确认添加后 shopId 正确。 */
const ADMIN='https://e.joho.cn/admin-api';
async function gql(q,v={},auth,ch){const h={'Content-Type':'application/json'};if(auth)h.Authorization='Bearer '+auth;if(ch)h['vendure-token']=ch;const r=await fetch(ADMIN,{method:'POST',headers:h,body:JSON.stringify({query:q,variables:v})});const j=await r.json();if(j.errors){const e=new Error(j.errors.map(x=>x.message).join('; '));e.d=j.data;throw e;}return j.data;}
(async()=>{
  const t1='a6fn474hhiqasmyiyrfl';
  const r=await fetch(ADMIN,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:`mutation{login(username:"zhao@163.com",password:"23123"){...on CurrentUser{id identifier}}}`})});
  const auth=r.headers.get('vendure-auth-token');
  console.log('auth?', auth?'yes':'no');
  if(!auth){ console.log('店主登录失败'); process.exit(1); }

  // 0) 当前店主归属店铺
  try {
    const ms=await gql(`query{ myShop { id name slug status } }`,{},auth,t1);
    console.log('\n当前店主 myShop:', JSON.stringify(ms.myShop,null,2));
  } catch(e){ console.log('myShop 查询受限(可能渠道视图)', e.message); }

  // 1) add 前商品归属
  const before=await gql(`query{ products(options:{filter:{id:{eq:"50"}}}){ totalItems items{ id name customFields{ shopId } } } }`,{},auth,t1);
  console.log('\nadd 前:', JSON.stringify(before.products.items,null,2));

  // 2) addProductToMyShop
  try {
    const res=await gql(`mutation{ addProductToMyShop(productId:"50") }`,{},auth,t1);
    console.log('\naddProductToMyShop:', JSON.stringify(res,null,2));
  } catch(e){ console.log('\nadd ERR:', e.message); if(e.d) console.log(JSON.stringify(e.d,null,2)); process.exitCode=2; }

  // 3) add 后商品归属
  const after=await gql(`query{ products(options:{filter:{id:{eq:"50"}}}){ totalItems items{ id name customFields{ shopId } } } }`,{},auth,t1);
  console.log('\nadd 后:', JSON.stringify(after.products.items,null,2));

  // 4) myShopOrders 是否包含订单 6JQ1ETJU7YR3MA3C
  const mo=await gql(`query{ myShopOrders { orderId code state totalWithTax } }`,{},auth,t1);
  const hit=(mo.myShopOrders||[]).filter(o=>o.code==='6JQ1ETJU7YR3MA3C');
  console.log('\nmyShopOrders 总数:', (mo.myShopOrders||[]).length, ' 命中6JQ1ETJU7YR3MA3C:', hit.length, hit[0]?JSON.stringify(hit[0]):'');
})().catch(e=>{console.error('ERR',e.message);if(e.d)console.error(JSON.stringify(e.d));process.exit(2)});