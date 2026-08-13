/**
 * WeChat Pay Dev Bypass E2E 测试
 * 验证：登录 → 加购 → 下单 → 支付 → metadata 返回 → dev-notify 结算
 */
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const SHOP_API = 'http://localhost:3000/shop-api';
const ADMIN_API = 'http://localhost:3000/admin-api';
const DEV_NOTIFY = 'http://localhost:3000/wechatpay/dev-notify';

const CUSTOMER_EMAIL = 'lisi@test.cn'; // 有余额，但走微信支付
const CUSTOMER_PASSWORD = 'test';

function log(step, msg) { console.log(`[${step}] ${msg}`); }
function fail(step, msg) { console.error(`[${step}] FAIL: ${msg}`); process.exit(1); }

async function gql(endpoint, query, variables = {}, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['vendure-auth-token'] = token;
    }
    const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors) throw new Error(`GraphQL: ${JSON.stringify(json.errors)}`);
    return { data: json.data, token: res.headers.get('vendure-auth-token') || token };
}

async function main() {
    // === 0. 验证 wechatpay PaymentMethod 存在 ===
    log('0', '验证 wechatpay PaymentMethod');
    const adminLogin = await gql(ADMIN_API,
        `mutation { login(username: "superadmin", password: "superadmin") { ...on CurrentUser { identifier } } }`);
    const adminToken = adminLogin.token;
    const pms = await gql(ADMIN_API,
        `{ paymentMethods { items { id code name enabled } } }`, {}, adminToken);
    const wechatpay = pms.data.paymentMethods.items.find(p => p.code === 'wechatpay');
    if (!wechatpay) fail('0', 'wechatpay PaymentMethod 不存在');
    log('0', `OK: ${wechatpay.name} enabled=${wechatpay.enabled}`);

    // === 1. 客户登录 ===
    log('1', `客户登录: ${CUSTOMER_EMAIL}`);
    const loginRes = await gql(SHOP_API,
        `mutation($u: String!, $p: String!) { login(username: $u, password: $p) { ...on CurrentUser { id identifier } ...on ErrorResult { errorCode message } } }`,
        { u: CUSTOMER_EMAIL, p: CUSTOMER_PASSWORD });
    if (!loginRes.data.login.id) fail('1', `登录失败: ${JSON.stringify(loginRes.data.login)}`);
    const customerToken = loginRes.token;
    log('1', `OK: customer id=${loginRes.data.login.id}`);

    // === 2. 获取/创建 ActiveOrder ===
    log('2', '获取 ActiveOrder');
    let orderRes = await gql(SHOP_API,
        `query { activeOrder { id code state totalQuantity totalWithTax } }`, {}, customerToken);
    let order = orderRes.data.activeOrder;
    if (!order) {
        log('2', '无 activeOrder，创建新订单');
        // 加商品到购物车
        const addRes = await gql(SHOP_API,
            `mutation($i: ID!, $q: Int!) { addItemToOrder(productVariantId: $i, quantity: $q) { ...on Order { id code state totalQuantity totalWithTax } ...on ErrorResult { errorCode message } } }`,
            { i: '1', q: 1 }, customerToken);
        order = addRes.data.addItemToOrder;
        if (!order.id) fail('2', `加购失败: ${JSON.stringify(order)}`);
    }
    log('2', `OK: order code=${order.code} state=${order.state} qty=${order.totalQuantity} total=${order.totalWithTax}`);

    // 如果订单为空，加一个商品
    if (order.totalQuantity === 0) {
        log('2b', '订单为空，加购商品 variant=1 qty=1');
        const addRes = await gql(SHOP_API,
            `mutation($i: ID!, $q: Int!) { addItemToOrder(productVariantId: $i, quantity: $q) { ...on Order { id code state totalQuantity totalWithTax } ...on ErrorResult { errorCode message } } }`,
            { i: '1', q: 1 }, customerToken);
        order = addRes.data.addItemToOrder;
        log('2b', `OK: qty=${order.totalQuantity} total=${order.totalWithTax}`);
    }

    // === 3. 设置收货地址 ===
    log('3', '设置收货地址');
    const addrRes = await gql(SHOP_API,
        `mutation($i: CreateAddressInput!) { setOrderShippingAddress(input: $i) { ...on Order { id state } ...on ErrorResult { errorCode message } } }`,
        { i: { fullName: '李四', phoneNumber: '13800138002', streetLine1: '北京市朝阳区望京街10号', city: '北京市', province: '北京市', postalCode: '100102', countryCode: 'CN' } },
        customerToken);
    if (addrRes.data.setOrderShippingAddress.errorCode) fail('3', `设置地址失败: ${JSON.stringify(addrRes.data.setOrderShippingAddress)}`);
    log('3', 'OK');

    // === 4. 设置配送方式 ===
    log('4', '获取可用配送方式');
    const shipMethodsRes = await gql(SHOP_API,
        `query { eligibleShippingMethods { id name code priceWithTax } }`, {}, customerToken);
    const ships = shipMethodsRes.data.eligibleShippingMethods;
    if (!ships || ships.length === 0) fail('4', '无可用配送方式');
    const ship = ships[0];
    log('4', `选择: ${ship.name} (code=${ship.code}, price=${ship.priceWithTax})`);
    const setShipRes = await gql(SHOP_API,
        `mutation($id: [ID!]!) { setOrderShippingMethod(shippingMethodId: $id) { ...on Order { id state shippingWithTax } ...on ErrorResult { errorCode message } } }`,
        { id: [ship.id] }, customerToken);
    if (setShipRes.data.setOrderShippingMethod.errorCode) fail('4', `设置配送失败: ${JSON.stringify(setShipRes.data.setOrderShippingMethod)}`);
    log('4', `OK: shippingWithTax=${setShipRes.data.setOrderShippingMethod.shippingWithTax}`);

    // === 5. 转换到 ArrangingPayment ===
    log('5', '转换订单状态到 ArrangingPayment');
    const transRes = await gql(SHOP_API,
        `mutation($s: String!) { transitionOrderToState(state: $s) { ...on Order { id state } ...on ErrorResult { errorCode message } } }`,
        { s: 'ArrangingPayment' }, customerToken);
    if (transRes.data.transitionOrderToState.errorCode) {
        // 可能已经在 ArrangingPayment
        log('5', `warn: ${transRes.data.transitionOrderToState.message}`);
    } else {
        log('5', `OK: state=${transRes.data.transitionOrderToState.state}`);
    }

    // === 6. 查询可用支付方式 ===
    log('6', '获取可用支付方式');
    const payMethodsRes = await gql(SHOP_API,
        `query { eligiblePaymentMethods { id code name isEligible } }`, {}, customerToken);
    const payMethods = payMethodsRes.data.eligiblePaymentMethods;
    const wp = payMethods.find(p => p.code === 'wechatpay');
    if (!wp || !wp.isEligible) fail('6', `wechatpay 不可用: ${JSON.stringify(payMethods)}`);
    log('6', `OK: wechatpay isEligible=${wp.isEligible}`);

    // === 7. 调用 addPaymentToOrder (微信支付) ===
    log('7', '调用 addPaymentToOrder (wechatpay)');
    const payRes = await gql(SHOP_API,
        `mutation($input: PaymentInput!) {
            addPaymentToOrder(input: $input) {
                ...on Order { id code state payments { id method amount state transactionId metadata } }
                ...on ErrorResult { errorCode message }
            }
        }`,
        { input: { method: 'wechatpay', metadata: {} } }, customerToken);
    const payOrder = payRes.data.addPaymentToOrder;
    if (payOrder.errorCode) fail('7', `addPayment 失败: ${JSON.stringify(payOrder)}`);
    log('7', `OK: order state=${payOrder.state} code=${payOrder.code}`);
    const payments = payOrder.payments || [];
    const lastPayment = payments[payments.length - 1];
    log('7', `lastPayment: id=${lastPayment.id} method=${lastPayment.method} state=${lastPayment.state} tx=${lastPayment.transactionId}`);
    log('7', `metadata: ${JSON.stringify(lastPayment.metadata)}`);

    // Shop API 的 Payment.metadata 只暴露 metadata.public 字段
    const pub = lastPayment.metadata?.public || {};
    if (!pub.payUrl) {
        fail('7', `metadata.public.payUrl 缺失! metadata=${JSON.stringify(lastPayment.metadata)}`);
    }
    if (!lastPayment.transactionId || !lastPayment.transactionId.startsWith('DEV-WECHATPAY-')) {
        fail('7', `transactionId 不正确: ${lastPayment.transactionId}`);
    }
    log('7', `OK: payUrl=${pub.payUrl}`);

    // === 8. 模拟 dev-notify 回调结算 ===
    log('8', `调用 dev-notify: orderCode=${payOrder.code}`);
    const notifyRes = await fetch(`${DEV_NOTIFY}?orderCode=${payOrder.code}`, { method: 'POST' });
    const notifyJson = await notifyRes.json();
    log('8', `dev-notify response: ${JSON.stringify(notifyJson)}`);
    if (notifyJson.code !== 'SUCCESS') fail('8', `dev-notify 失败: ${notifyJson.message || ''}`);

    // 等待一下让结算完成
    await new Promise(r => setTimeout(r, 1500));

    // === 9. 验证订单已结算 ===
    log('9', '验证订单状态');
    const finalRes = await gql(SHOP_API,
        `query($code: String!) { orderByCode(code: $code) { id code state payments { id state transactionId } } }`,
        { code: payOrder.code }, customerToken);
    const finalOrder = finalRes.data.orderByCode;
    log('9', `final order: state=${finalOrder.state}`);
    for (const p of finalOrder.payments) {
        log('9', `  payment id=${p.id} state=${p.state} tx=${p.transactionId}`);
    }

    if (finalOrder.state !== 'PaymentSettled' && finalOrder.state !== 'ArrangingPayment') {
        // PaymentSettled 后通常会自动转到 PaymentAuthorized 或其他状态
        log('9', `note: final state=${finalOrder.state}`);
    }
    const settledPayment = finalOrder.payments.find(p => p.state === 'Settled');
    if (!settledPayment) {
        fail('9', `payment 未结算! payments=${JSON.stringify(finalOrder.payments)}`);
    }
    log('9', `OK: payment id=${settledPayment.id} 已结算 Settled`);

    console.log('\n========================================');
    console.log('✓ E2E 测试全部通过!');
    console.log('========================================');
    console.log(`订单: ${finalOrder.code}`);
    console.log(`状态: ${finalOrder.state}`);
    console.log(`支付: ${settledPayment.id} (Settled)`);
}

main().catch(e => { console.error('未捕获错误:', e); process.exit(1); });
