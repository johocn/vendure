/* 生产探测：确认 admin 登录、渠道列表、是否存在商家渠道
 * 不写入任何数据，只读。
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

async function login(url, username, password, chToken) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(chToken ? { 'vendure-token': chToken } : {}) },
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
    const who = process.argv[2] || 'zhao@163.com';
    const pwd = process.argv[3] || '23123';
    console.log(`[probe] 登录 admin-api as ${who}`);
    const adm = await login(ADMIN, who, pwd);
    console.log('[probe] admin 登录成功:', adm.cu.identifier);

    // 当前账号可见渠道（me.channels）
    let r = await gql(ADMIN, `query{ me{ id identifier channels{ id code token } } }`, {}, adm.auth);
    const me = r.me;
    console.log('[probe] me.channels:', JSON.stringify(me.channels ?? 'N/A'));

    // 渠道列表（含 seller 信息）
    r = await gql(
        ADMIN,
        `query($o: ChannelListOptions){ channels(options:$o){ totalItems items{ id code token seller{ id name customFields{ marketplaceMerchant } } customFields{ settlementBasis } } } }`,
        { o: { take: 100 } },
        adm.auth,
    );
    const channels = r.channels;
    console.log('[probe] 渠道总数:', channels.totalItems);
    for (const c of channels.items) {
        const m = c.seller ? ` seller#${c.seller.id}=${c.seller.name}(marketplaceMerchant=${c.seller.customFields?.marketplaceMerchant})` : ' (无 seller)';
        console.log(`  channel: code=${c.code} token=${c.token} settlementBasis=${c.customFields?.settlementBasis ?? '(null)'}${m}`);
    }

    // marketplace 商品数
    r = await gql(ADMIN, `query{ marketplacePendingProducts{ id name slug customFields{ marketplaceStatus listedInMarketplace } } }`, {}, adm.auth);
    console.log('[probe] marketplacePendingProducts(admin):', JSON.stringify(r.marketplacePendingProducts ?? 'QUERY_NOT_AVAILABLE'));

    // 商家自营商品数（default token）
    r = await gql(ADMIN, `query{ products(options:{take:5}){ totalItems items{ id name customFields{ barcode listedInMarketplace marketplaceStatus } } } }`, {}, adm.auth);
    console.log('[probe] 商品总数:', r.products.totalItems);
    for (const p of r.products.items) {
        console.log(`  product id=${p.id} name=${p.name} barcode=${p.customFields?.barcode ?? '-'} listed=${p.customFields?.listedInMarketplace} status=${p.customFields?.marketplaceStatus}`);
    }
}

main().catch((e) => {
    console.error('probe error:', e.message);
    console.error(e.data ? 'data=' + JSON.stringify(e.data) : '');
    process.exit(2);
});
