// 阶段42 SSO互通 实测
// 覆盖：统一映射表(ExternalAuthenticationMethod)、SSO↔本地账号互认(方向A自动合并/建档 + 方向B登录后主动绑定)。
// 依赖：dev-server 以 SSO_MOCK=true 运行在 localhost:3000，且未配置真实 zhao-sso 时走 mock 取号。
// Usage:  node --env-file=../packages/dev-server/.env tools/e2e-sso.mjs   （若 .env 已有变量可省略 env-file）
// 说明：mock code 约定（见 sso-authentication-strategy）：
//   mock-loc__<phone>   → 命中 "按手机号合并" 路径（phone_number/mobile=ident）
//   mock-oauth__<id>    → 命中 "SSO 建档" 路径（email=ident@mock.test）
const { default: fetch } = await import('node-fetch');

const ADMIN_API = 'http://localhost:3000/admin-api';
const SHOP_API = 'http://localhost:3000/shop-api';
const PROVIDER_KEY = 'sso-mock';
const DEFAULT_CHANNEL = '__default_channel__';

async function call(endpoint, query, variables = {}, token = '') {
    const headers = { 'Content-Type': 'application/json', 'vendure-channel-token': DEFAULT_CHANNEL };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
    const body = await res.json();
    const authToken = res.headers.get('vendure-auth-token');
    if (body.errors && !body.data) {
        throw Object.assign(new Error(`[${body.errors.map(e => e.message).join('; ')}] Q: ${query.replace(/\s+/g, ' ').slice(0, 200)}`), { body, query });
    }
    return { data: body.data, authToken, body };
}
const admin = (q, v = {}, t = '') => call(ADMIN_API, q, v, t);
const shop = (q, v = {}, t = '') => call(SHOP_API, q, v, t);

let pass = 0, fail = 0;
const assert = (c, m, extra = '') => {
    if (c) { pass++; console.log(`  ✓ ${m}`); }
    else { fail++; console.log(`  ✗ ${m} ${extra}`); }
};

async function ssoLogin(code) {
    const r = await shop(`mutation($lk:String!,$c:String!){ authenticate(input:{ sso:{ providerKey:$lk, code:$c } }){ ... on CurrentUser { id identifier } ... on ErrorResult { message errorCode } } }`, { lk: PROVIDER_KEY, c: code });
    return { token: r.authToken, id: r.data?.authenticate?.id, err: r.data?.authenticate?.message };
}

async function register(email, { password = 'a963963', phoneNumber } = {}) {
    const r = await shop(`mutation($i:RegisterCustomerInput!){ registerCustomerAccount(input:$i){ ... on Success { success } } }`, { i: { emailAddress: email, firstName: '测', lastName: '试', password, ...(phoneNumber ? { phoneNumber } : {}) } });
    if (!r.data?.registerCustomerAccount?.success) {
        throw Object.assign(new Error('registerCustomerAccount failed'), r.body);
    }
}
async function nativeLogin(username) {
    const r = await shop(`mutation($u:String!,$p:String!){ login(username:$u,password:$p){ ... on CurrentUser { id } ... on ErrorResult { message } } }`, { u: username, p: 'a963963' });
    return { token: r.authToken, id: r.data?.login?.id, err: r.data?.login?.message };
}

async function main() {
    console.log('=== 阶段42 SSO互通 实测 ===\n');

    // 0. admin 登录
    const aLogin = await admin(`mutation($u:String!,$p:String!){ login(username:$u,password:$p){ ... on CurrentUser { id } } }`, { u: 'superadmin@china.test', p: 'superadmin' });
    const adminToken = aLogin.authToken;
    assert(adminToken, 'admin 登录成功');
    if (!adminToken) process.exit(1);

    // 1. 配置渠道 SSO provider（合并现有 enabledMethods，wordmark 保真）
    const chans = await admin(`query { channels { items { id code customFields { authConfig { enabledMethods overridesJson ssoProvidersJson } } } } }`, {}, adminToken);
    const defChannel = chans.data.channels.items.find(c => c.code === DEFAULT_CHANNEL) || chans.data.channels.items[0];
    const channelId = defChannel.id;
    const curEnabled = Array.isArray(defChannel.customFields?.authConfig?.enabledMethods)
        ? defChannel.customFields.authConfig.enabledMethods
        : ['native', 'phone', 'wechat', 'alipay', 'douyin', 'sso'];
    const mergedMethods = [...new Set([...curEnabled, 'native', 'phone', 'sso'])];
    const cfg = await admin(`mutation($cid:ID!,$input:JSON!){ updateChannelAuthConfig(channelId:$cid, input:$input){ enabledMethods ssoProviders { providerKey } } }`, {
        cid: channelId,
        input: { enabledMethods: mergedMethods, ssoProviders: [{ name: 'Mock SSO', providerKey: PROVIDER_KEY, protocol: 'zhao-sso', baseUrl: 'http://sso.mock', clientId: 'app', clientSecret: 'sec', scopes: ['openid'] }] },
    }, adminToken);
    assert(cfg.data?.updateChannelAuthConfig?.ssoProviders?.some(p => p.providerKey === PROVIDER_KEY), `渠道已配置 SSO provider(${PROVIDER_KEY})，enabledMethods=${(cfg.data?.updateChannelAuthConfig?.enabledMethods || []).join('/')}`);
    assert(cfg.data?.updateChannelAuthConfig?.enabledMethods?.includes('sso'), 'enabledMethods 含 sso');

    // 2. 方向A-按手机合并：先建本地账号(含手机号)，再用 mock-loc 该手机 SSO 登录 → 应归并到同一账号
    const uniq = Date.now();
    const locEmail = `sso-loc-${uniq}@example.com`;
    const locPhone = `139${String(uniq).slice(-8)}`;
    await register(locEmail, { phoneNumber: locPhone });
    const local = await nativeLogin(locEmail);
    assert(!!local.token && !!local.id, `本地账号已建档并登录 id=${local.id}`);
    if (!local.token) process.exit(1);

    // SSO mock-loc 登录：手机命中 → 绑定到 localUser
    const ssolLoc = await ssoLogin(`mock-loc__${locPhone}`);
    assert(!!ssolLoc.token && ssolLoc.id === local.id, `SSO mock-loc(${locPhone}) 登录归并到本地账号 id=${ssolLoc.id}`);
    if (ssolLoc.id !== local.id) { console.log('  [debug] local.id=', local.id, 'ssolLoc.id=', ssolLoc.id, 'err=', ssolLoc.err); }
    // 再次登录 → 统一映射表命中，同一账号稳定
    const ssolLoc2 = await ssoLogin(`mock-loc__${locPhone}`);
    assert(ssolLoc2.id === local.id, `统一映射表生效：再次 SSO 登录仍归同一账号 id=${ssolLoc2.id}`);

    // 3. SSO 建档（无本地账号）→ 新建账号，且映射稳定
    const freshKey = `fresh${uniq}`;
    const ssoA = await ssoLogin(`mock-oauth__${freshKey}`);
    assert(!!ssoA.token && !!ssoA.id, `SSO mock-oauth 建档新账号 id=${ssoA.id}`);
    const ssoA2 = await ssoLogin(`mock-oauth__${freshKey}`);
    assert(ssoA2.id === ssoA.id, `同一 SSO 外部身份稳定映射同账号 id=${ssoA2.id}`);

    // 4. 方向B-绑定互认：本地登录后主动绑定 SSO 身份 → 之后该 SSO 登录即命中此账号
    const loc2Email = `sso-bind-${uniq}@example.com`;
    await register(loc2Email);
    const loc2 = await nativeLogin(loc2Email);
    assert(!!loc2.token && !!loc2.id, `本地账号2 已登录 id=${loc2.id}`);
    const bindKey = `bindme${uniq}`;
    const bind = await shop(`mutation($lk:String!,$c:String!){ bindSsoIdentity(providerKey:$lk, code:$c){ bound userId identifier reason } }`, { lk: PROVIDER_KEY, c: `mock-oauth__${bindKey}` }, loc2.token);
    assert(bind.data?.bindSsoIdentity?.bound === true && String(bind.data.bindSsoIdentity.userId) === String(loc2.id), `方向B：已登录账号主动绑定 SSO 身份成功 (bound=true, userId=${bind.data?.bindSsoIdentity?.userId})`);
    if (bind.data?.bindSsoIdentity?.bound !== true) console.log('  [debug] bindSsoIdentity resp:', JSON.stringify(bind.data?.bindSsoIdentity));
    const ssoB = await ssoLogin(`mock-oauth__${bindKey}`);
    assert(ssoB.id === loc2.id, `互认达成：SSO 登录(绑定后)命中本地账号2 id=${ssoB.id}（期望=${loc2.id}）`);

    console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
    process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('ERROR:', e.message); if (e.body) console.error(JSON.stringify(e.body)); process.exit(1); });