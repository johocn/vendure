// t2 渠道建「商品专属券」测试数据（供 web-admin 截图：券列表全标签 + 商品绑券区块）
// 1. guoxinnanshan 登录（t2 租户管理员）
// 2. t2 渠道内建 SKU 券模板（claimable+claimCode+newCustomerOnly → 全标签）
// 3. t2 渠道内建 ProductCouponBinding（商品 id 60 国信南山温泉节假日房间）
const ADMIN = 'https://e.joho.cn/admin-api';
const CH = 'cnx87ezvmjx8nn3bth6c';
async function gql(q, v, headers = {}) {
  const r = await fetch(ADMIN, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ query: q, variables: v || {} }) });
  return { tok: r.headers.get('vendure-auth-token'), json: await r.json() };
}
const login = await gql('mutation($u:String!,$p:String!){ login(username:$u,password:$p){ __typename } }', { u: 'superadmin', p: 'z123123' });
if (!login.json?.data) throw new Error('login failed ' + JSON.stringify(login.json).slice(0, 200));
const AH = { Authorization: 'Bearer ' + login.tok, 'vendure-channel-token': CH };
const t = await gql('query{ myTenantAccess{ channels{ id code token } } }', {}, AH);
// superadmin 无租户绑定；t2 token 直接用之前探测值
const t2 = { code: 't2', token: '66ruvnhh34svhckaa2i' };
const CH2 = { Authorization: 'Bearer ' + login.tok, 'vendure-channel-token': t2.token };

// 幂等：查已有
const ex = await gql('query($o:Int!){ couponTemplates(options:{take:$o}){ items{ id name scope claimable claimCode newCustomerOnly } } }', { o: 50 }, CH2);
const items = ex.json?.data?.couponTemplates?.items || [];
let tpl = items.find((x) => x.name && x.name.includes('专属券-t2'));
let claimCode;
if (tpl) {
  claimCode = tpl.claimCode;
  console.log('existing t2 template:', tpl.id, claimCode);
} else {
  claimCode = 'T2SKU' + String(Date.now()).slice(-5);
  const mk = await gql('mutation($i:CreateCouponTemplateInput!){ createCouponTemplate(input:$i){ id scope claimable claimCode newCustomerOnly name } }',
    { i: { name: '专属券-t2-温泉房间', description: 't2 渠道商品专属券（web-admin 截图用）', scope: 'SKU', variantId: 58, claimable: true, claimCode, validDays: 5, newCustomerOnly: true, type: 'PERCENT', discountValue: 15 } }, CH2);
  if (mk.json?.data?.createCouponTemplate?.id) {
    tpl = mk.json.data.createCouponTemplate;
    console.log('created t2 template:', tpl.id, claimCode, JSON.stringify(tpl));
  } else {
    console.log('CREATE FAILED:', JSON.stringify(mk.json).slice(0, 500));
    process.exit(1);
  }
}

// binding：t2 商品 60 国信南山温泉节假日房间
const binds = await gql('query($p:Int!){ productCouponBindings(productId:$p){ id productId couponTemplateId enabled badgeText } }', { p: 60 }, CH2);
const bprev = (binds.json?.data?.productCouponBindings || []).find((b) => String(b.couponTemplateId) === String(tpl.id));
if (!bprev) {
  const b = await gql('mutation($i:CreateProductCouponBindingInput!){ createProductCouponBinding(input:$i){ id productId variantIds couponTemplateId enabled badgeText } }',
    { i: { productId: 60, variantIds: [58], couponTemplateId: Number(tpl.id), badgeText: '温泉专享' } }, CH2);
  console.log('binding:', JSON.stringify(b.json?.data?.createProductCouponBinding || b.json).slice(0, 300));
} else {
  console.log('binding exists:', bprev.id);
}
console.log('=== KEY t2 === tplId:', tpl.id, 'claimCode:', claimCode, 'channel token:', t2.token.slice(0, 6));
