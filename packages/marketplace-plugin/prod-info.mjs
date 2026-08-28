/* 生产信息探测：支付方式 / 配送方式 / 自营商品变体 / 客户，为 marketplace 端到端验证准备
 * 只读。
 */
const ADMIN = 'https://e.joho.cn/admin-api';
const SHOP = 'https://e.joho.cn/shop-api';

async function gql(url, query, variables = {}, auth, chToken) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) headers['Authorization'] = `Bearer ${auth}`;
    if (chToken) headers['vendure-token'] = chToken;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
    const json = await res.json();
    if (json.errors) {
        const e = json.errors.map((x) => x.message).join('; ');
        const err = new Error('GraphQL: ' + e);
        err.data = json.data;
        throw err;
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
    console.log(`[info] 登录 admin-api as ${who}`);
    const adm = await loginAdmin(ADMIN, who, pwd);

    // 1) 支付方式
    let r = await gql(ADMIN, `query{ paymentMethods(options:{take:50}){ totalItems items{ id code name enabled } } }`, {}, adm.auth);
    console.log('[info] 支付方式:', JSON.stringify(r.paymentMethods.items.map(pm => ({ code: pm.code, enabled: pm.enabled }))));

    // 2) 配送方式
    r = await gql(ADMIN, `query{ shippingMethods(options:{take:50}){ totalItems items{ id code name } } }`, {}, adm.auth);
    console.log('[info] 配送方式:', JSON.stringify(r.shippingMethods.items.map(sm => ({ id: sm.id, code: sm.code }))));

    // 3) 自营商品变体（default 渠道，取少量）
    r = await gql(ADMIN, `query{ productVariants(options:{take:10}){ totalItems items{ id sku name enabled stockOnHand priceWithTax } } }`, {}, adm.auth);
    console.log('[info] 变体总数:', r.productVariants.totalItems);
    for (const v of r.productVariants.items) {
        console.log(`  variant id=${v.id} sku=${v.sku} name=${v.name} enabled=${v.enabled} stock=${v.stockOnHand}`);
    }

    // 4) 客户（取少量，找测试客户）
    r = await gql(ADMIN, `query{ customers(options:{take:15}){ totalItems items{ id firstName lastName emailAddress phoneNumber } } }`, {}, adm.auth);
    console.log('[info] 客户总数:', r.customers.totalItems);
    for (const c of r.customers.items) {
        console.log(`  customer id=${c.id} ${c.lastName}${c.firstName} email=${c.emailAddress} phone=${c.phoneNumber ?? '-'}`);
    }
}

main().catch((e) => {
    console.error('info error:', e.message);
    console.error(e.data ? 'data=' + JSON.stringify(e.data) : '');
    process.exit(2);
});
