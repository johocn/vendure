/* 探测生产 schema：库存 mutation + 结账 mutation 参数类型 */
const ADMIN = 'https://e.joho.cn/admin-api';
const SHOP = 'https://e.joho.cn/shop-api';

async function main() {
    // admin 登录
    const r = await fetch(ADMIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: 'mutation($u:String!,$p:String!){ login(username:$u,password:$p){ ...on CurrentUser{ id } } }',
            variables: { u: 'superadmin', p: 'z123123' },
        }),
    });
    const auth = r.headers.get('vendure-auth-token');

    async function mutationArgs(url, auth, names) {
        const q = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) },
            body: JSON.stringify({
                query: `{ __type(name:"Mutation"){ fields{ name args{ name type{ kind name ofType{ kind name ofType{ kind name } } } } } } }`,
            }),
        });
        const json = await q.json();
        const fields = json.data?.__type?.fields ?? [];
        for (const n of names) {
            const f = fields.find((x) => x.name === n);
            if (!f) { console.log(`${n}: 不存在`); continue; }
            const args = f.args.map((a) => `${a.name}: ${a.type.kind === 'NON_NULL' ? a.type.ofType.name + '!' : a.type.name}`);
            console.log(`${n}(${args.join(', ')})`);
        }
    }

    console.log('[admin] 库存/相关 mutation:');
    await mutationArgs(ADMIN, auth, ['adjustStockOnHand', 'createStockMovement', 'createStockAdjustment', 'updateProductVariants']);

    console.log('[shop] 结账 mutation:');
    await mutationArgs(SHOP, null, ['setOrderShippingAddress', 'updateOrderShippingAddress', 'setOrderShippingMethod', 'setShippingMethod', 'addItemToOrder', 'transitionOrderToState']);
}

main().catch((e) => {
    console.error(e.message);
    process.exit(2);
});
