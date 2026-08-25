/* 生产闭环驱动：真实 API 走通「门店自提下单→固定聚合码收款→备货 Shipped→顾客取码→店主收银核销」
 * 买家/店主均为 zhao@163.com / 23123（customer user=2 下单，administrator user=4 收银）
 * 渠道 t1 token: a6fn474hhiqasmyiyrfl
 */
const ADMIN = 'https://e.joho.cn/admin-api';
const SHOP = 'https://e.joho.cn/shop-api';
const USER = { email: 'zhao@163.com', password: '23123' };
const CH = 'a6fn474hhiqasmyiyrfl';
const VARIANT_ID = 6; // SPK-BT-01 石墨黑（product 3，t1 店归属）
const SHIP_ID = 1; // store-pickup 门店自提

async function gql(url, query, variables = {}, auth, chToken) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) headers['Authorization'] = `Bearer ${auth}`;
    if (chToken) headers['vendure-token'] = chToken;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
    const json = await res.json();
    if (json.errors) {
        const e = json.errors.map((x) => x.message).join('; ');
        const err = new Error('GraphQL: ' + e);
        err.data = json.data;
        throw err;
    }
    return json.data;
}

async function login(url, email, password, chToken) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(chToken ? { 'vendure-token': chToken } : {}) },
        body: JSON.stringify({
            query: `mutation($u:String!,$p:String!){ login(username:$u,password:$p){ ...on CurrentUser{ id identifier } ...on ErrorResult{ errorCode message } } }`,
            variables: { u: email, p: password },
        }),
    });
    const json = await res.json();
    const cu = json.data?.login;
    if (!cu || !cu.id) throw new Error('登录失败: ' + JSON.stringify(cu));
    return { auth: res.headers.get('vendure-auth-token'), cu };
}

async function main() {
    // ---------- A. 顾客（shop-api, t1）下单自提 → 固定聚合码付款 ----------
    const shop = await login(SHOP, USER.email, USER.password, CH);
    console.log('[A] shop 登录:', shop.cu.identifier);

    let r = await gql(SHOP, `mutation{ addItemToOrder(productVariantId:"${VARIANT_ID}",quantity:1){ ...on Order{ id } ...on ErrorResult{ errorCode message } } }`, {}, shop.auth, CH);
    if (r.addItemToOrder?.errorCode) throw new Error('加购失败: ' + JSON.stringify(r.addItemToOrder));
    console.log('[A] 加购成功 order=', r.addItemToOrder.id);

    r = await gql(SHOP, `mutation{ setOrderCustomFields(input:{ customFields:{ deliveryType:"pickup" } }){ ...on Order{ id state } ...on ErrorResult{ errorCode message } } }`, {}, shop.auth, CH);
    if (r.setOrderCustomFields?.errorCode) throw new Error('设 deliveryType 失败: ' + JSON.stringify(r.setOrderCustomFields));
    console.log('[A] deliveryType=pickup');

    r = await gql(SHOP, `mutation{ setOrderShippingAddress(input:{ fullName:"测试顾客" streetLine1:"到店自提测试地址" postalCode:"100000" city:"北京" countryCode:"CN" }){ ...on Order{ id } ...on ErrorResult{ errorCode message } } }`, {}, shop.auth, CH);
    if (r.setOrderShippingAddress?.errorCode) throw new Error('设地址失败: ' + JSON.stringify(r.setOrderShippingAddress));

    r = await gql(SHOP, `query{ eligibleShippingMethods{ id code name } }`, {}, shop.auth, CH);
    const sms = r.eligibleShippingMethods;
    console.log('[A] 可选配送:', sms.map((s) => `${s.code}#${s.id}`).join(', '));
    if (!sms.some((s) => Number(s.id) === SHIP_ID)) throw new Error('store-pickup 不在可选列表');
    await gql(SHOP, `mutation{ setOrderShippingMethod(shippingMethodId:"${SHIP_ID}"){ ...on Order{ id } ...on ErrorResult{ errorCode message } } }`, {}, shop.auth, CH);

    r = await gql(SHOP, `mutation{ transitionOrderToState(state:"ArrangingPayment"){ ...on Order{ id state } ...on ErrorResult{ errorCode message } } }`, {}, shop.auth, CH);
    const orderId = r.transitionOrderToState?.id;
    if (!orderId) throw new Error('转 ArrangingPayment 失败: ' + JSON.stringify(r.transitionOrderToState));

    r = await gql(SHOP, `mutation{ addPaymentToOrder(input:{ method:"fixed-aggregate-collection" metadata:{ fixedAggregateCode:"POS-FILL-001" } }){ ...on Order{ id state totalWithTax } ...on ErrorResult{ errorCode message } } }`, {}, shop.auth, CH);
    if (r.addPaymentToOrder?.errorCode) throw new Error('付款失败: ' + JSON.stringify(r.addPaymentToOrder));
    console.log('[A] 已付款 order#' + orderId + ' state=' + r.addPaymentToOrder.state + ' 应付分=' + r.addPaymentToOrder.totalWithTax);

    // ---------- B. 店主（admin-api, t1）确认到账(PaymentSettled) → 备货 → Shipped ----------
    const owner = await login(ADMIN, USER.email, USER.password, CH);
    console.log('[B] admin 登录:', owner.cu.identifier);

    // 固定聚合码收款：createPayment 返回 Authorized（订单 PaymentAuthorized），
    // 店员确认到账后调用 settlePayment → 支付 Settled，订单自动转 PaymentSettled
    r = await gql(ADMIN, `query{ order(id:"${orderId}"){ state payments{ id state method } } }`, {}, owner.auth, CH);
    const payment = r.order.payments.find((p) => p.state === 'Authorized');
    if (!payment) throw new Error('未找到 Authorized 支付: ' + JSON.stringify(r.order.payments));
    r = await gql(ADMIN, `mutation{ settlePayment(id:"${payment.id}"){ ...on Payment{ state } ...on ErrorResult{ errorCode message } } }`, {}, owner.auth, CH);
    if (r.settlePayment?.errorCode) throw new Error('结算支付失败: ' + JSON.stringify(r.settlePayment));
    console.log('[B] 已确认到账:', r.settlePayment.state);

    r = await gql(ADMIN, `query{ order(id:"${orderId}"){ id state lines{ id quantity } } }`, {}, owner.auth, CH);
    const lines = r.order.lines.map((l) => `{ orderLineId:"${l.id}", quantity:${l.quantity} }`).join(' ');
    r = await gql(ADMIN, `mutation{ addFulfillmentToOrder(input:{ lines:[${lines}] handler:{ code:"manual-fulfillment" arguments:[ {name:"method",value:"到店自提"} {name:"trackingCode",value:"PICKUP"} ] } }){ ...on Fulfillment{ id state } ...on ErrorResult{ errorCode message } } }`, {}, owner.auth, CH);
    if (r.addFulfillmentToOrder?.errorCode) throw new Error('建履约失败: ' + JSON.stringify(r.addFulfillmentToOrder));
    const fid = r.addFulfillmentToOrder.id;
    console.log('[B] 履约创建:', fid, r.addFulfillmentToOrder.state);

    await gql(ADMIN, `mutation{ transitionFulfillmentToState(id:"${fid}", state:"Shipped"){ ...on Fulfillment{ state } } }`, {}, owner.auth, CH);
    r = await gql(ADMIN, `query{ order(id:"${orderId}"){ state } }`, {}, owner.auth, CH);
    if (r.order.state !== 'Shipped') {
        r = await gql(ADMIN, `mutation{ transitionOrderToState(id:"${orderId}", state:"Shipped"){ ...on Order{ state } ...on ErrorResult{ errorCode message } } }`, {}, owner.auth, CH);
        if (r.transitionOrderToState?.errorCode) throw new Error('订单转 Shipped 失败: ' + JSON.stringify(r.transitionOrderToState));
    }
    console.log('[B] 订单已 Shipped');

    // ---------- C. 顾客取码 ----------
    r = await gql(SHOP, `query{ myPickupCode(orderId:"${orderId}"){ id code status } }`, {}, shop.auth, CH);
    const code = r.myPickupCode.code;
    console.log('[C] 核销码生成:', code, 'status=' + r.myPickupCode.status);

    // ---------- D. 店主收银核销 ----------
    r = await gql(ADMIN, `query{ myPickupOrders(options:{ take:100 skip:0 }){ items{ id orderId orderCode code status } totalItems } }`, {}, owner.auth, CH);
    const hit = r.myPickupOrders.items.find((i) => String(i.orderId) === String(orderId));
    if (!hit) throw new Error('店主 myPickupOrders 未命中本店自提单');
    console.log('[D] myPickupOrders 命中: 核销码=' + hit.code + ' status=' + hit.status);

    r = await gql(ADMIN, `mutation{ claimPickupByShop(code:"${code}"){ id orderId code status claimChannel claimedAt } }`, {}, owner.auth, CH);
    const claim = r.claimPickupByShop;
    console.log('[D] claimPickupByShop:', JSON.stringify(claim));

    // 重复核销应被拒
    let retryRejected = false;
    try {
        await gql(ADMIN, `mutation{ claimPickupByShop(code:"${code}"){ id status } }`, {}, owner.auth, CH);
    } catch (e) {
        retryRejected = true;
        console.log('[D] 重复核销被拒（预期）:', e.message.split(';')[0]);
    }
    if (!retryRejected) throw new Error('重复核销未被拒');

    r = await gql(ADMIN, `query{ order(id:"${orderId}"){ state fulfillments{ state } customFields{ pickupClaimed } } }`, {}, owner.auth, CH);
    const result = {
        redemptionId: claim.id,
        orderCode: hit.orderCode,
        code,
        status: claim.status,
        claimChannel: claim.claimChannel,
        orderStateAfter: r.order.state,
        fulfillmentStates: r.order.fulfillments.map((f) => f.state),
        pickupClaimed: r.order.customFields?.pickupClaimed,
    };
    const ok =
        result.status === 'redeemed' &&
        result.claimChannel === 'shop' &&
        (result.orderStateAfter === 'PartiallyDelivered' || result.orderStateAfter === 'Delivered') &&
        result.fulfillmentStates.includes('Delivered') &&
        result.pickupClaimed === true;
    console.log('\n===== 生产收款确认闭环验证结果 =====');
    console.log(JSON.stringify(result, null, 2));
    console.log(ok ? '\nPASS: 确认收款核销成功、履约达 Delivered、订单标记 pickupClaimed=true、核销码一次性失效' : '\nFAIL');
    process.exit(ok ? 0 : 1);
}

main().catch((e) => {
    console.error('run error:', e.message);
    console.error(e.data ? 'data=' + JSON.stringify(e.data) : '');
    process.exit(2);
});
