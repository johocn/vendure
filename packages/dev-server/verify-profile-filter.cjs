// E2E 验证：农夫山泉天然水 Profile 级配送/支付过滤
// 验证点：
// 1. eligibleShippingMethodsByProfile 只返回 store-pickup
// 2. eligiblePickupLocationsByProfile 只返回自由大路门店
// 3. checkPickupLocationConstraint 返回 true（已约束）
// 4. 前端加载 active order 后能提取 shippingProfileId
const http = require('http');

const SHOP_API = 'http://localhost:3000/shop-api';
let sessionCookieStr = null;

function parseSessionCookies(setCookie) {
    if (!setCookie) return null;
    const parts = [];
    for (const c of setCookie) {
        const m = c.match(/^([^=]+)=([^;]+)/);
        if (m && (m[1] === 'session' || m[1] === 'session.sig' || m[1] === 'vendure-auth-token')) {
            parts.push(`${m[1]}=${m[2]}`);
        }
    }
    return parts.length ? parts.join('; ') : null;
}

function gql(query, variables) {
    const body = JSON.stringify({ query, variables });
    const headers = { 'Content-Type': 'application/json' };
    if (sessionCookieStr) headers['Cookie'] = sessionCookieStr;
    return new Promise((resolve, reject) => {
        const req = http.request(SHOP_API, { method: 'POST', headers }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                const parsed = parseSessionCookies(res.headers['set-cookie']);
                if (parsed) sessionCookieStr = parsed;
                try { resolve(JSON.parse(data)); }
                catch { resolve({ data: null, errors: [{ message: data }] }); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

const log = (label, obj) => console.log(`\n[${label}]`, JSON.stringify(obj, null, 2));

async function main() {
    console.log('========== 农夫山泉 Profile 级过滤 E2E 验证 ==========\n');

    // 1. 登录（用之前的测试客户）
    const loginRes = await gql(`
        mutation($u: String!, $p: String!) {
            login(username: $u, password: $p) { ... on CurrentUser { identifier } ... on InvalidCredentialsError { message } }
        }
    `, { u: 'e2e-test@test.com', p: 'test123456' });
    log('1. 登录', loginRes.data?.login);
    if (!loginRes.data?.login?.identifier) { console.error('登录失败'); return; }

    // 2. 清空购物车 + 加购农夫山泉天然水（variant id=1）
    // 先查 active order，如果有就清空
    const activeRes = await gql(`query { activeOrder { id lines { id quantity productVariant { id name customFields { shippingProfileId paymentProfileId } } } } }`, {});
    log('2a. 当前 activeOrder', activeRes.data?.activeOrder || 'null');

    if (activeRes.data?.activeOrder?.id) {
        // 清空购物车（逐个删除 line）
        for (const line of activeRes.data.activeOrder.lines || []) {
            await gql(`mutation($id: ID!) { removeOrderLine(orderLineId: $id) { ... on Order { id } ... on ErrorResult { message } } }`, { id: line.id });
        }
        console.log('2b. 已清空购物车');
    }

    // 加购农夫山泉
    const addRes = await gql(`
        mutation($pvid: ID!, $q: Int!) {
            addItemToOrder(productVariantId: $pvid, quantity: $q) {
                ... on Order { id code totalQuantity
                    lines { id quantity productVariant { id name customFields { shippingProfileId paymentProfileId } } } }
                ... on ErrorResult { message }
            }
        }
    `, { pvid: '1', q: 1 });
    log('3. 加购农夫山泉天然水', addRes.data?.addItemToOrder);
    if (addRes.errors) { console.error('加购失败', addRes.errors); return; }
    if (addRes.data?.addItemToOrder?.message) { console.error('加购失败:', addRes.data.addItemToOrder.message); return; }

    const order = addRes.data.addItemToOrder;
    const shippingProfileIds = [...new Set(order.lines.map(l => l.productVariant.customFields?.shippingProfileId).filter(Boolean))];
    const paymentProfileIds = [...new Set(order.lines.map(l => l.productVariant.customFields?.paymentProfileId).filter(Boolean))];
    console.log(`\n提取到 shippingProfileIds: ${JSON.stringify(shippingProfileIds)}`);
    console.log(`提取到 paymentProfileIds: ${JSON.stringify(paymentProfileIds)}`);

    if (shippingProfileIds.length === 0) {
        console.error('\n❌ 未提取到 shippingProfileIds，请检查 variant customFields 是否正确返回');
        return;
    }

    // 4. 验证 eligibleShippingMethodsByProfile
    const shipProfileRes = await gql(`
        query($pids: [ID!]!) {
            eligibleShippingMethodsByProfile(profileIds: $pids) { id code name }
        }
    `, { pids: shippingProfileIds });
    log('4. Profile 级可用配送方式', shipProfileRes.data?.eligibleShippingMethodsByProfile);
    const allowedShipMethods = shipProfileRes.data?.eligibleShippingMethodsByProfile || [];
    const onlyStorePickup = allowedShipMethods.length === 1 && allowedShipMethods[0].code === 'store-pickup';
    console.log(`   ${onlyStorePickup ? '✅ 仅门店自提' : '❌ 应仅门店自提，实际: ' + allowedShipMethods.map(m => m.code).join(',')}`);

    // 5. 验证 checkPickupLocationConstraint
    const constraintRes = await gql(`
        query($pids: [ID!]!) { checkPickupLocationConstraint(profileIds: $pids) }
    `, { pids: shippingProfileIds });
    log('5. 是否约束自提点', constraintRes.data?.checkPickupLocationConstraint);
    const constrained = constraintRes.data?.checkPickupLocationConstraint === true;
    console.log(`   ${constrained ? '✅ 已约束自提点' : '❌ 应约束自提点'}`);

    // 6. 验证 eligiblePickupLocationsByProfile
    const locRes = await gql(`
        query($pids: [ID!]!) {
            eligiblePickupLocationsByProfile(profileIds: $pids) { id name type address }
        }
    `, { pids: shippingProfileIds });
    log('6. Profile 级可用自提点', locRes.data?.eligiblePickupLocationsByProfile);
    const allowedLocs = locRes.data?.eligiblePickupLocationsByProfile || [];
    const onlyZiyou = allowedLocs.length === 1 && allowedLocs[0].name.includes('自由大路');
    console.log(`   ${onlyZiyou ? '✅ 仅自由大路门店' : '❌ 应仅自由大路，实际: ' + allowedLocs.map(l => l.name).join(',')}`);

    // 7. 验证 paymentProfile（如果有的话）
    if (paymentProfileIds.length > 0) {
        const payProfileRes = await gql(`
            query($pids: [ID!]!) {
                eligiblePaymentMethodsByProfile(profileIds: $pids) { id code name }
            }
        `, { pids: paymentProfileIds });
        log('7. Profile 级可用支付方式', payProfileRes.data?.eligiblePaymentMethodsByProfile);
    } else {
        console.log('\n7. 无 paymentProfileId，跳过支付方式验证');
    }

    console.log('\n========== 验证总结 ==========');
    console.log(`配送方式: ${onlyStorePickup ? '✅' : '❌'} 仅门店自提`);
    console.log(`自提点约束: ${constrained ? '✅' : '❌'} 已约束`);
    console.log(`自提点列表: ${onlyZiyou ? '✅' : '❌'} 仅自由大路`);
    const allPass = onlyStorePickup && constrained && onlyZiyou;
    console.log(`\n${allPass ? '✅ 全部验证通过' : '❌ 存在失败项'}`);
}

main().catch(console.error);
