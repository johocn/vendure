/* 生产配送/支付方式详情探测：default 渠道与各渠道可用的配送方式、支付方式
 * 只读。
 */
const ADMIN = 'https://e.joho.cn/admin-api';

async function gql(url, query, variables = {}, auth, chToken) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) headers['Authorization'] = `Bearer ${auth}`;
    if (chToken) headers['vendure-token'] = chToken;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
    const json = await res.json();
    if (json.errors) {
        const e = json.errors.map((x) => x.message).join('; ');
        throw new Error('GraphQL: ' + e);
    }
    return json.data;
}

async function loginAdmin(url, username, password) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: `mutation($u:String!,$p:String!){ login(username:$u,password:$p){ ...on CurrentUser{ id identifier } ...on ErrorResult{ errorCode message } } }`,
            variables: { u: username, p: password },
        }),
    });
    const json = await res.json();
    const cu = json.data?.login;
    if (!cu || !cu.id) throw new Error('登录失败: ' + JSON.stringify(cu));
    return { auth: res.headers.get('vendure-auth-token'), cu };
}

async function main() {
    const who = process.argv[2] || 'superadmin';
    const pwd = process.argv[3] || 'z123123';
    const adm = await loginAdmin(ADMIN, who, pwd);

    // 渠道列表
    const ch = await gql(ADMIN, `query{ channels(options:{take:50}){ totalItems items{ id code token } } }`, {}, adm.auth);
    console.log('[ship] 渠道:', JSON.stringify(ch.channels.items.map(c => ({ id: c.id, code: c.code }))));

    for (const c of ch.channels.items) {
        // 各渠道可用配送方式
        let r;
        try {
            r = await gql(
                ADMIN,
                `query{ shippingMethods(options:{take:50}){ totalItems items{ id code checker{ code } calculator{ code } } } }`,
                {},
                adm.auth,
                c.token,
            );
            const sms = r.shippingMethods.items.map(sm => ({ id: sm.id, code: sm.code, checker: sm.checker?.code, calc: sm.calculator?.code }));
            console.log(`[ship] channel=${c.code} 配送方式(${r.shippingMethods.totalItems}):`, JSON.stringify(sms));
        } catch (e) {
            console.log(`[ship] channel=${c.code} 配送方式查询失败: ${e.message}`);
        }
        try {
            r = await gql(
                ADMIN,
                `query{ paymentMethods(options:{take:50}){ totalItems items{ id code name enabled } } }`,
                {},
                adm.auth,
                c.token,
            );
            const pms = r.paymentMethods.items.map(pm => ({ id: pm.id, code: pm.code, enabled: pm.enabled }));
            console.log(`[pay] channel=${c.code} 支付方式(${r.paymentMethods.totalItems}):`, JSON.stringify(pms));
        } catch (e) {
            console.log(`[pay] channel=${c.code} 支付方式查询失败: ${e.message}`);
        }
    }
}

main().catch((e) => {
    console.error('ship error:', e.message);
    process.exit(2);
});
