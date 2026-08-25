/* 造一条「待核销」自提单（A 下单→付款→备货 Shipped→C 取码），不核销，供浏览器收银台验证 */
const ADMIN = 'https://e.joho.cn/admin-api';
const SHOP = 'https://e.joho.cn/shop-api';
const USER = { email: 'zhao@163.com', password: '23123' };
const CH = 'a6fn474hhiqasmyiyrfl';
const VARIANT_ID = 6;
const SHIP_ID = 1;

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
    const shop = await login(SHOP, USER.email, USER.password, CH);
    console.log('[A] shop 登录:', shop.cu.identifier);

    let r = await gql(SHOP, `mutation{ addItemToOrder(productVariantId:"${VARIANT_ID}",quantity:1){ ...on Order{ id } ...on ErrorResult{ errorCode message } } }`, {}, shop.auth, CH);
    if (r.addItemToOrder?.errorCode) throw new Error('加购失败: ' + JSON.stringify(r.addItemToOrder));
    console.log('[A] 加购成功 order=', r.addItemToOrder.id);

    r = await gql(SHOP, `mutation{ setOrderCustomFields(input:{ customFields:{ deliveryType:"pickup" } }){ ...on Order{ id state } ...on ErrorResult{ errorCode message } } }`, {}, shop.auth, CH);
    if (r.setOrderCustomFields?.errorCode) throw new Error('设 deliveryType 失败: ' + JSON.stringify(r.setOrderCustomFields));

    r = await gql(SHOP, `mutation{ setOrderShippingAddress(input:{ fullName:"测试顾客" streetLine1:"到店自提测试地址" postalCode:"100000" city:"北京" countryCode:"CN" }){ ...on Order{ id } ...on ErrorResult{ errorCode message } } }`, {}, shop.auth, CH);
    if (r.setOrderShippingAddress?.errorCode) throw new Error('设地址失败: ' + JSON.stringify(r.setOrderShippingAddress));

    r = await gql(SHOP, `query{ eligibleShippingMethods{ id code name } }`, {}, shop.auth, CH);
    const sms = r.eligibleShippingMethods;
    if (!sms.some((s) => Number(s.id) === SHIP_ID)) throw new Error('store-pickup 不在可选列表');
    await gql(SHOP, `mutation{ setOrderShippingMethod(shippingMethodId:"${SHIP_ID}"){ ...on Order{ id } ...on ErrorResult{ errorCode message } } }`, {}, shop.auth, CH);

    r = await gql(SHOP, `mutation{ transitionOrderToState(state:"ArrangingPayment"){ ...on Order{ id state } ...on ErrorResult{ errorCode message } } }`, {}, shop.auth, CH);
    const orderId = r.transitionOrderToState?.id;
    if (!orderId) throw new Error('转 ArrangingPayment 失败: ' + JSON.stringify(r.transitionOrderToState));

    r = await gql(SHOP, `mutation{ addPaymentToOrder(input:{ method:"fixed-aggregate-collection" metadata:{ fixedAggregateCode:"POS-FILL-001" } }){ ...on Order{ id state totalWithTax } ...on ErrorResult{ errorCode message } } }`, {}, shop.auth, CH);
    if (r.addPaymentToOrder?.errorCode) throw new Error('付款失败: ' + JSON.stringify(r.addPaymentToOrder));
    console.log('[A] 已付款 order#' + orderId + ' state=' + r.addPaymentToOrder.state + ' 应付分=' + r.addPaymentToOrder.totalWithTax);

    // B. 店主确认到账 + 备货 Shipped
    const owner = await login(ADMIN, USER.email, USER.password, CH);
    r = await gql(ADMIN, `query{ order(id:"${orderId}"){ state payments{ id state method } } }`, {}, owner.auth, CH);
    const payment = r.order.payments.find((p) => p.state === 'Authorized');
    if (!payment) throw new Error('未找到 Authorized 支付');
    r = await gql(ADMIN, `mutation{ settlePayment(id:"${payment.id}"){ ...on Payment{ state } ...on ErrorResult{ errorCode message } } }`, {}, owner.auth, CH);
    if (r.settlePayment?.errorCode) throw new Error('结算支付失败: ' + JSON.stringify(r.settlePayment));
    console.log('[B] 已确认到账:', r.settlePayment.state);

    r = await gql(ADMIN, `query{ order(id:"${orderId}"){ id state lines{ id quantity } } }`, {}, owner.auth, CH);
    const lines = r.order.lines.map((l) => `{ orderLineId:"${l.id}", quantity:${l.quantity} }`).join(' ');
    r = await gql(ADMIN, `mutation{ addFulfillmentToOrder(input:{ lines:[${lines}] handler:{ code:"manual-fulfillment" arguments:[ {name:"method",value:"到店自提"} {name:"trackingCode",value:"PICKUP"} ] } }){ ...on Fulfillment{ id state } ...on ErrorResult{ errorCode message } } }`, {}, owner.auth, CH);
    if (r.addFulfillmentToOrder?.errorCode) throw new Error('建履约失败: ' + JSON.stringify(r.addFulfillmentToOrder));
    const fid = r.addFulfillmentToOrder.id;
    await gql(ADMIN, `mutation{ transitionFulfillmentToState(id:"${fid}", state:"Shipped"){ ...on Fulfillment{ state } } }`, {}, owner.auth, CH);
    r = await gql(ADMIN, `query{ order(id:"${orderId}"){ state } }`, {}, owner.auth, CH);
    if (r.order.state !== 'Shipped') {
        r = await gql(ADMIN, `mutation{ transitionOrderToState(id:"${orderId}", state:"Shipped"){ ...on Order{ state } ...on ErrorResult{ errorCode message } } }`, {}, owner.auth, CH);
        if (r.transitionOrderToState?.errorCode) throw new Error('订单转 Shipped 失败: ' + JSON.stringify(r.transitionOrderToState));
    }
    console.log('[B] 订单已 Shipped');

    // C. 顾客取码
    r = await gql(SHOP, `query{ myPickupCode(orderId:"${orderId}"){ id code status } }`, {}, shop.auth, CH);
    console.log('\n===== 待核销自提单已就绪 =====');
    console.log('orderId:', orderId);
    console.log('code(核销码):', r.myPickupCode.code);
    console.log('status:', r.myPickupCode.status);
}

main().catch((e) => {
    console.error('run error:', e.message);
    console.error(e.data ? 'data=' + JSON.stringify(e.data) : '');
    process.exit(2);
});
