/* 探测 setVariantStock 参数 + CreateAddressInput 字段 */
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
            query: `{ __type(name:"Mutation"){ fields{ name args{ name type{ kind name ofType{ kind name ofType{ kind name ofType{ kind name } } } } } } } }`,
        }),
    });
    const json = await q.json();
    const fields = json.data.__type.fields;
    for (const n of ['setVariantStock', 'createStockInOrder']) {
        const f = fields.find((x) => x.name === n);
        if (!f) { console.log(`${n}: 不存在`); continue; }
        console.log(`${n} args:`, f.args.map((a) => {
            const t = a.type;
            const name = t.kind === 'NON_NULL' ? t.ofType.name : t.name;
            return `${a.name}: ${name}${t.kind === 'NON_NULL' ? '!' : ''}`;
        }).join(', '));
    }

    // CreateAddressInput 字段
    const aq = await fetch(ADMIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth },
        body: JSON.stringify({ query: `{ __type(name:"CreateAddressInput"){ inputFields{ name type{ kind name ofType{ kind name } } } } }` }),
    });
    const ajson = await aq.json();
    const inputFields = ajson.data?.__type?.inputFields?.map((f) => `${f.name}${f.type.kind === 'NON_NULL' ? '!' : ''}:${f.type.ofType?.name ?? f.type.name}`) ?? [];
    console.log('CreateAddressInput 字段:', inputFields.join(', '));
}

main().catch((e) => {
    console.error(e.message);
    process.exit(2);
});
