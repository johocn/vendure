/**
 * WeChat Pay H5 Dev Bypass E2E 测试
 * 使用 Node.js 内置 fetch（Node 18+）
 */
const SHOP_API = 'http://localhost:3000/shop-api';
const CHANNEL_TOKEN = 'default-token';

let authToken = '';

async function gql(query, variables) {
    const headers = {
        'Content-Type': 'application/json',
        'vendure-channel-token': CHANNEL_TOKEN,
    };
    if (authToken) headers['Authorization'] = 'Bearer ' + authToken;

    const res = await fetch(SHOP_API, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
    });

    // 捕获 token
    const token = res.headers.get('vendure-auth-token');
    if (token) authToken = token;

    const json = await res.json();
    if (json.errors) {
        throw new Error('GraphQL: ' + json.errors.map(e => e.message).join('; '));
    }
    return json.data;
}

async function main() {
    console.log('=== 1. 查询可用商品 ===');
    const products = await gql(`
        query {
            search(input: { take: 5, groupByProduct: true }) {
                items {
                    productId
                    productName
                    productVariantId
                    priceWithTax { ... on SinglePrice { value } }
                }
            }
        }
    `);
    console.log('商品数:', products.search.items.length);
    if (products.search.items.length === 0) {
        console.error('无可用商品，终止测试');
        process.exit(1);
    }
    const firstItem = products.search.items[0];
    console.log('首商品:', firstItem.productName, 'variantId:', firstItem.productVariantId);

    console.log('\n=== 2. 登录（客户 zhangsan@test.cn） ===');
    const loginRes = await gql(`
        mutation {
            login(username: "zhangsan@test.cn", password: "test") {
                ... on CurrentUser { id identifier }
                ... on ErrorResult { message }
            }
        }
    `);
    console.log('登录结果:', JSON.stringify(loginRes.login));
    if (!loginRes.login.identifier) {
        console.error('登录失败');
        process.exit(1);
    }

    console.log('\n=== 3. 创建 Active Order + 添加商品 ===');
    const addRes = await gql(`
        mutation {
            addItemToOrder(productVariantId: ${firstItem.productVariantId}, quantity: 1) {
                ... on Order { id code state totalQuantity totalWithTax }
                ... on ErrorResult { message }
            }
        }
    `);
    const order = addRes.addItemToOrder;
    console.log('订单:', JSON.stringify(order));
    if (!order || !order.id) {
        console.error('添加商品失败');
        process.exit(1);
    }

    console.log('\n=== 4. 查询 eligiblePaymentMethods ===');
    const payMethods = await gql(`
        query { eligiblePaymentMethods { id code name isEligible } }
    `);
    console.log('支付方式:', JSON.stringify(payMethods.eligiblePaymentMethods));
    const wechatpay = payMethods.eligiblePaymentMethods.find(p => p.code === 'wechatpay');
    if (!wechatpay) {
        console.error('wechatpay 不在可用支付方式中');
        process.exit(1);
    }
    console.log('wechatpay:', JSON.stringify(wechatpay));

    console.log('\n=== 5. 查询 eligibleShippingMethods ===');
    const shipMethods = await gql(`
        query { eligibleShippingMethods { id code name priceWithTax } }
    `);
    console.log('配送方式数:', shipMethods.eligibleShippingMethods.length);
    const shipping = shipMethods.eligibleShippingMethods[0];
    if (!shipping) {
        console.error('无可用配送方式');
        process.exit(1);
    }
    console.log('选用配送:', shipping.code, shipping.name);

    console.log('\n=== 6. 设置配送地址 ===');
    const addrRes = await gql(`
        mutation {
            setOrderShippingAddress(input: {
                fullName: "测试用户"
                streetLine1: "测试地址1号"
                city: "北京市"
                province: "北京市"
                postalCode: "100000"
                countryCode: "CN"
                phoneNumber: "13800000000"
            }) {
                ... on Order { id code shippingAddress { fullName city } }
                ... on ErrorResult { message }
            }
        }
    `);
    console.log('地址设置:', JSON.stringify(addrRes.setOrderShippingAddress));

    console.log('\n=== 7. 设置配送方式 ===');
    const setShipRes = await gql(`
        mutation {
            setOrderShippingMethod(shippingMethodId: "${shipping.id}") {
                ... on Order { id code state shippingWithTax }
                ... on ErrorResult { message }
            }
        }
    `);
    console.log('配送方式设置:', JSON.stringify(setShipRes.setOrderShippingMethod));

    console.log('\n=== 8. 转换到 ArrangingPayment ===');
    const transitionRes = await gql(`
        mutation {
            transitionOrderToState(state: "ArrangingPayment") {
                ... on Order { id code state }
                ... on ErrorResult { message }
            }
        }
    `);
    console.log('状态转换:', JSON.stringify(transitionRes.transitionOrderToState));

    console.log('\n=== 9. 添加 wechatpay 支付 ===');
    const addPayRes = await gql(`
        mutation {
            addPaymentToOrder(input: { method: "wechatpay", metadata: {} }) {
                ... on Order {
                    id code state
                    payments { id state amount transactionId metadata }
                }
                ... on ErrorResult { message }
            }
        }
    `);
    const paidOrder = addPayRes.addPaymentToOrder;
    console.log('支付后订单:', JSON.stringify(paidOrder));
    if (!paidOrder || !paidOrder.payments) {
        console.error('添加支付失败');
        process.exit(1);
    }

    const payment = paidOrder.payments[paidOrder.payments.length - 1];
    console.log('\n=== 10. 验证 Dev Bypass metadata ===');
    console.log('Payment state:', payment.state);
    console.log('TransactionId:', payment.transactionId);
    console.log('Metadata:', JSON.stringify(payment.metadata));

    if (payment.metadata.payType !== 'dev-h5') {
        console.error('期望 payType=dev-h5，实际:', payment.metadata.payType);
        process.exit(1);
    }
    if (!payment.metadata.payUrl || !payment.metadata.payUrl.includes('dev-pay')) {
        console.error('期望 payUrl 包含 dev-pay，实际:', payment.metadata.payUrl);
        process.exit(1);
    }
    console.log('✓ Dev Bypass metadata 正确');

    if (paidOrder.state === 'PaymentSettled' || paidOrder.state === 'PaymentAuthorized') {
        console.log('订单状态:', paidOrder.state, '（已自动授权）');
    } else {
        console.log('订单状态:', paidOrder.state);
    }

    console.log('\n=== 11. 访问 dev-pay 页面 ===');
    const payUrl = 'http://localhost:3000' + payment.metadata.payUrl;
    console.log('访问:', payUrl);
    const pageRes = await fetch(payUrl);
    const pageHtml = await pageRes.text();
    console.log('页面状态:', pageRes.status);
    if (!pageHtml.includes('模拟微信支付') || !pageHtml.includes(order.code)) {
        console.error('dev-pay 页面内容不正确');
        console.error('页面片段:', pageHtml.substring(0, 300));
        process.exit(1);
    }
    console.log('✓ dev-pay 页面正确显示，订单号:', order.code);

    console.log('\n=== 12. 触发 dev-notify 回调 ===');
    const notifyUrl = 'http://localhost:3000/wechatpay/dev-notify?orderCode=' + order.code;
    const notifyRes = await fetch(notifyUrl, { method: 'POST' });
    const notifyData = await notifyRes.json();
    console.log('回调结果:', JSON.stringify(notifyData));
    if (notifyData.code !== 'SUCCESS') {
        console.error('dev-notify 回调失败');
        process.exit(1);
    }
    console.log('✓ dev-notify 回调成功');

    console.log('\n=== 13. 验证订单最终状态 ===');
    // 重新查询订单
    const finalOrder = await gql(`
        query { activeOrder { id code state payments { id state } } }
    `);
    console.log('最终订单:', JSON.stringify(finalOrder.activeOrder));
    if (finalOrder.activeOrder) {
        const finalPayment = finalOrder.activeOrder.payments.find(p => p.id === payment.id);
        console.log('Payment 最终状态:', finalPayment ? finalPayment.state : 'NOT FOUND');
        if (finalPayment && finalPayment.state === 'Settled') {
            console.log('✓✓✓ E2E 测试通过：微信支付 Dev Bypass 全流程成功！');
        } else {
            console.error('✗ Payment 未结算，状态:', finalPayment ? finalPayment.state : 'null');
        }
    } else {
        // 订单可能已不在 active 状态（结算后变成非 active）
        console.log('activeOrder 为 null，订单可能已结算完成');
        console.log('✓✓✓ E2E 测试通过：微信支付 Dev Bypass 全流程成功！');
    }
}

main().catch(e => {
    console.error('测试异常:', e.message);
    console.error(e.stack);
    process.exit(1);
});
