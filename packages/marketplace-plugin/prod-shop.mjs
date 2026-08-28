/* 生产 Shop API 结账相关字段 introspection（只读）
 */
const SHOP = 'https://e.joho.cn/shop-api';

async function gql(url, query, variables = {}, chToken) {
    const headers = { 'Content-Type': 'application/json' };
    if (chToken) headers['vendure-token'] = chToken;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
    return await res.json();
}

async function main() {
    // Mutation
    let r = await gql(SHOP, `{ __type(name:"Mutation"){ fields{ name } } }`);
    const muts = r.data?.__type?.fields?.map((f) => f.name) ?? [];
    const wanted = [
        'addItemToOrder', 'setShippingAddress', 'setShippingMethod', 'setCustomerForOrder',
        'transitionOrderToState', 'addPaymentToOrder', 'payMarketplaceSellerOrder',
        'registerMarketplaceSeller', 'submitForMarketplace', 'login', 'logout', 'createCustomer',
        'requestPasswordReset', 'updateOrderShippingAddress', 'setOrderShippingMethod',
        'removeAllOrderLines', 'transitionToState', 'addPayment',
    ];
    console.log('[shop] 结账 mutation 存在性:');
    for (const w of wanted) console.log(`  ${w}: ${muts.includes(w)}`);
    console.log('[shop] 全部 mutation:', JSON.stringify(muts));

    // Query
    r = await gql(SHOP, `{ __type(name:"Query"){ fields{ name } } }`);
    const qs = r.data?.__type?.fields?.map((f) => f.name) ?? [];
    console.log('[shop] query 存在性:');
    for (const w of ['activeOrder', 'myMarketplaceSellerOrders', 'marketplaceProducts', 'me', 'activeChannel']) {
        console.log(`  ${w}: ${qs.includes(w)}`);
    }
}

main().catch((e) => {
    console.error('error:', e.message);
    process.exit(2);
});
