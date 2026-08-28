/* 探测生产：商品 customFields.merchantRef 实际返回结构 */
const ADMIN = 'https://e.joho.cn/admin-api';

async function main() {
    const r = await fetch(ADMIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: 'mutation($u:String!,$p:String!){ login(username:$u,password:$p){ ...on CurrentUser{ id } } }',
            variables: { u: 'superadmin', p: 'z123123' },
        }),
    });
    const auth = r.headers.get('vendure-auth-token');
    const q = await fetch(ADMIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth },
        body: JSON.stringify({
            query: `{ products(options:{take:50}){ items{ id name customFields{ merchantRef{ id code name } marketplaceStatus listedInMarketplace } } } }`,
        }),
    });
    console.log(JSON.stringify(await q.json(), null, 1));
}

main().catch((e) => {
    console.error(e.message);
    process.exit(2);
});
