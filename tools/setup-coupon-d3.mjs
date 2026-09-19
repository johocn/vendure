// 线上建「商品专属券」测试数据：
// 1. superadmin 登录
// 2. 找 bluetooth-earbuds-pro 商品的第一个 variant
// 3. 建 SKU 券模板（claimable + claimCode + validDays + newCustomerOnly 用于拦截测试）
// 4. 建 ProductCouponBinding
// 幂等：先查已有，避免重复
import { createInterface } from 'node:readline';

const ADMIN = 'https://e.joho.cn/admin-api';
const SHOP = 'https://www.youshop.cn/shop-api';
const CH = 'cnx87ezvmjx8nn3bth6c';
const SUPER = ['superadmin', 'z123123'];
const PRODUCT_SLUG = '黄金珠宝';

async function gql(url, q, v, headers = {}) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ query: q, variables: v || {} }),
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  const tok = r.headers.get('vendure-auth-token');
  return { tok, json };
}

const login = await gql(ADMIN, 'mutation($u:String!,$p:String!){ login(username:$u,password:$p){ __typename } }', { u: SUPER[0], p: SUPER[1] });
if (!login.json?.data) throw new Error('admin login failed ' + JSON.stringify(login.json).slice(0, 300));
const AH = { Authorization: 'Bearer ' + login.tok, 'vendure-channel-token': CH };

// 商品 variant
const p = await gql(ADMIN, 'query($s:String!){ product(slug:$s){ id name variants{ id sku name } } }', { s: PRODUCT_SLUG }, AH);
const product = p.json?.data?.product;
if (!product) throw new Error('product not found: ' + JSON.stringify(p.json).slice(0, 300));
const v = product.variants[0];
console.log('product:', product.id, product.name, '| variant:', v.id, v.sku);

// 查现有同名券，幂等
const existing = await gql(ADMIN, 'query($o:Int!){ couponTemplates(options:{take:$o}){ items{ id name scope variantId claimable claimCode validDays newCustomerOnly } } }', { o: 50 }, AH);
const items = existing.json?.data?.couponTemplates?.items || [];
const prev = items.find((t) => t.name && t.name.includes('专属券-D3'));
let tplId, variantId, claimCode;
if (prev) {
  tplId = prev.id; variantId = prev.variantId; claimCode = prev.claimCode;
  console.log('existing template:', tplId, claimCode);
} else {
  claimCode = 'D3SKU' + String(Date.now()).slice(-5);
  const mk = await gql(ADMIN, `mutation($i:CreateCouponTemplateInput!){
    createCouponTemplate(input:$i){ id scope variantId claimable claimCode validDays newCustomerOnly name }
  }`, { i: {
    name: '专属券-D3-蓝牙耳机',
    description: 'D3 回归测试用 SKU 专属券',
    scope: 'SKU',
    variantId: Number(v.id),
    claimable: true,
    claimCode,
    validDays: 7,
    newCustomerOnly: false,
    type: 'PERCENT',
    discountValue: 10,
  } }, AH);
  if (mk.json?.data?.createCouponTemplate?.id) {
    tplId = mk.json.data.createCouponTemplate.id;
    variantId = mk.json.data.createCouponTemplate.variantId;
    console.log('created template:', tplId, claimCode, 'scope:', mk.json.data.createCouponTemplate.scope);
  } else {
    console.log('CREATE FAILED:', JSON.stringify(mk.json).slice(0, 600));
    process.exit(1);
  }
}

// binding
const bindings = await gql(ADMIN, 'query($p:Int!){ productCouponBindings(productId:$p){ id productId couponTemplateId enabled displayOrder } }', { p: Number(product.id) }, AH);
const bprev = (bindings.json?.data?.productCouponBindings || []).find((b) => String(b.couponTemplateId) === String(tplId));
if (!bprev) {
  const b = await gql(ADMIN, `mutation($i:CreateProductCouponBindingInput!){
    createProductCouponBinding(input:$i){ id productId variantIds couponTemplateId enabled badgeText }
  }`, { i: { productId: Number(product.id), variantIds: [Number(v.id)], couponTemplateId: Number(tplId), badgeText: '下单立减' } }, AH);
  console.log('binding:', JSON.stringify(b.json?.data?.createProductCouponBinding || b.json).slice(0, 300));
} else {
  console.log('binding exists:', bprev.id);
}

// 打印给截图用的关键值
console.log('=== KEY ===');
console.log('productId:', product.id, '| variantId:', v.id, '| tplId:', tplId, '| claimCode:', claimCode);
