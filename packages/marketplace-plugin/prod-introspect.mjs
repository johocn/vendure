/* 生产 schema introspection：列出 Query/Mutation 中 marketplace 相关字段与 Product 类型可查询字段
 * 只读，不写入任何数据。
 */
const ADMIN = 'https://e.joho.cn/admin-api';

async function gql(url, query, variables = {}, auth, chToken) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) headers['Authorization'] = `Bearer ${auth}`;
    if (chToken) headers['vendure-token'] = chToken;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
    return await res.json();
}

async function main() {
    const who = process.argv[2] || 'superadmin';
    const pwd = process.argv[3] || 'z123123';
    console.log(`[introspect] 登录 admin-api as ${who}`);
    const res = await fetch(ADMIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: `mutation($u:String!,$p:String!){ login(username:$u,password:$p){ ...on CurrentUser{ id identifier } ...on ErrorResult{ errorCode message } } }`,
            variables: { u: who, p: pwd },
        }),
    });
    const json = await res.json();
    const cu = json.data?.login;
    if (!cu || !cu.id) throw new Error('登录失败: ' + JSON.stringify(cu));
    const auth = res.headers.get('vendure-auth-token');
    console.log('[introspect] 登录成功:', cu.identifier);

    // 1) Query 类型上所有 marketplace 相关字段
    const q = await gql(ADMIN, `{ __type(name:"Query"){ fields{ name } } }`, {}, auth);
    const queryFields = q.data.__type.fields.map((f) => f.name).filter((n) => /market|merchant|settle/i.test(n));
    console.log('[introspect] Query marketplace 相关字段:', JSON.stringify(queryFields));

    // 2) Mutation 类型上 marketplace 相关字段
    const m = await gql(ADMIN, `{ __type(name:"Mutation"){ fields{ name } } }`, {}, auth);
    const mutationFields = m.data.__type.fields.map((f) => f.name).filter((n) => /market|merchant|settle/i.test(n));
    console.log('[introspect] Mutation marketplace 相关字段:', JSON.stringify(mutationFields));

    // 3) Product 类型字段（找 marketplaceStatus / listedInMarketplace / barcode / merchantRef）
    const p = await gql(ADMIN, `{ __type(name:"Product"){ fields{ name } } }`, {}, auth);
    const productFields = p.data.__type.fields.map((f) => f.name);
    const want = ['marketplaceStatus', 'listedInMarketplace', 'rejectReason', 'merchantRef', 'barcode', 'internalCode', 'customFields'];
    console.log('[introspect] Product 字段:', JSON.stringify(productFields));
    console.log('[introspect] Product 目标字段存在性:', JSON.stringify(want.reduce((a, k) => ((a[k] = productFields.includes(k)), a), {})));

    // 4) Order / Channel / Seller 目标字段
    for (const t of ['Order', 'Channel', 'Seller']) {
        const r = await gql(ADMIN, `{ __type(name:"${t}"){ fields{ name } } }`, {}, auth);
        const fields = r.data.__type.fields.map((f) => f.name);
        console.log(`[introspect] ${t} marketplace 字段:`, JSON.stringify(fields.filter((n) => /market|settle|saleSource/i.test(n))));
    }
}

main().catch((e) => {
    console.error('introspect error:', e.message);
    process.exit(2);
});
