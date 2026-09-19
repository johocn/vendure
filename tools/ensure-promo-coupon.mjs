// D3 线上回归前置：幂等创建「优惠券结算」Promotion（coupon_applied + coupon_discount）
// 结算链路依赖存活 Promotion 记录（conditions/actions、enabled、渠道关联），线上 promotion 表为空 → 先补建。
// 渠道：t2 结算（CH_T2）用 t2 channel token 创建，使 Promotion 关联 t2 渠道；默认渠道同样补一条。
import { default as fetch } from 'node-fetch';

const ADMIN_API = 'https://e.joho.cn/admin-api';
const SUPER = { u: 'superadmin', p: 'z123123' };
const CH_DEF = 'cnx87ezvmjx8nn3bth6c'; // __default_channel__
const CH_T2 = '66ruvnhh34svhckaa2i'; // t2 租户

async function gql(url, q, v, headers = {}) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ query: q, variables: v || {} }) });
  return { token: r.headers.get('vendure-auth-token') || '', body: await r.json() };
}

const login = await gql(ADMIN_API, 'mutation($u:String!,$p:String!){ login(username:$u,password:$p){ __typename } }', SUPER);
console.log('admin login:', login.token ? 'OK' : JSON.stringify(login.body));
if (!login.token) process.exit(1);
const AH = (ch) => ({ Authorization: 'Bearer ' + login.token, 'vendure-channel-token': ch });

async function ensurePromo(ch, name) {
  const h = AH(ch);
  // 幂等：按名字查
  const list = await gql(ADMIN_API, `query($o:PromotionListOptions){ promotions(options:$o){ items{ id name enabled } totalItems } }`, { o: { filter: { name: { contains: name } } } }, h);
  const found = list.body?.data?.promotions?.items?.find(p => p.name === name);
  if (found) { console.log(`[${ch}] 已存在 promotion ${found.id}: ${found.name}`); return found.id; }
  const created = await gql(ADMIN_API, `mutation { createPromotion(input: {
    enabled: true
    translations: [{ languageCode: zh_Hans, name: "${name}", description: "优惠券结算折扣（D3 线上回归）" }]
    conditions: [{ code: "coupon_applied", arguments: [] }]
    actions: [{ code: "coupon_discount", arguments: [] }]
  }) { ... on Promotion { id name enabled } ... on ErrorResult { message } } }`, {}, h);
  const p = created.body?.data?.createPromotion;
  console.log(`[${ch}] createPromotion:`, JSON.stringify(p ?? created.body.errors));
  return p?.id;
}

await ensurePromo(CH_DEF, '优惠券结算');
await ensurePromo(CH_T2, '优惠券结算-t2');
