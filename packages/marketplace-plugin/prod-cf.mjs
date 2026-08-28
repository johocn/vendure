/* 生产 schema introspection：查看各实体 customFields 对象实际包含的字段
 * 只读，不写入任何数据。
 */
const ADMIN = 'https://e.joho.cn/admin-api';

async function gql(url, query, variables = {}, auth) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) headers['Authorization'] = `Bearer ${auth}`;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
    return await res.json();
}

async function main() {
    const who = process.argv[2] || 'superadmin';
    const pwd = process.argv[3] || 'z123123';
    const res = await fetch(ADMIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: `mutation($u:String!,$p:String!){ login(username:$u,password:$p){ ...on CurrentUser{ id identifier } ...on ErrorResult{ errorCode message } } }`,
            variables: { u: who, p: pwd },
        }),
    });
    const body = await res.json();
    const cu = body.data?.login;
    if (!cu || !cu.id) throw new Error('登录失败: ' + JSON.stringify(cu));
    const auth = res.headers.get('vendure-auth-token');
    console.log('[cf] 登录成功:', cu.identifier);

    for (const t of ['Product', 'Order', 'Channel', 'Seller', 'ProductVariant', 'ProductOptionGroup']) {
        const r2 = await gql(
            ADMIN,
            `{ __type(name:"${t}"){ fields{ name type{ name kind ofType{ name } } } } }`,
            {},
            auth,
        );
        const cf = r2.data?.__type?.fields?.find((f) => f.name === 'customFields');
        if (!cf) {
            console.log(`[cf] ${t}: 无 customFields 字段`);
            continue;
        }
        const cname = cf.type.ofType?.name || cf.type.name;
        const r3 = await gql(ADMIN, `{ __type(name:"${cname}"){ fields{ name type{ name kind } } } }`, {}, auth);
        const fields = r3.data?.__type?.fields?.map((f) => `${f.name}:${f.type.name}`) ?? 'TYPE_NOT_FOUND';
        console.log(`[cf] ${t}.customFields (${cname}):`, JSON.stringify(fields));
    }
}

main().catch((e) => {
    console.error('cf error:', e.message);
    process.exit(2);
});
