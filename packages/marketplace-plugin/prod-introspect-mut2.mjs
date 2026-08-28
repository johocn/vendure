/* 探测生产 admin Mutation 全列表（找库存相关） */
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
        body: JSON.stringify({ query: `{ __type(name:"Mutation"){ fields{ name } } }` }),
    });
    const json = await q.json();
    const names = json.data.__type.fields.map((f) => f.name);
    console.log('[admin] Mutation 全列表:');
    console.log(names.join(', '));
    console.log('\n[admin] stock 相关:');
    console.log(names.filter((n) => /stock|level|adjust/i.test(n)).join(', '));
}

main().catch((e) => {
    console.error(e.message);
    process.exit(2);
});
