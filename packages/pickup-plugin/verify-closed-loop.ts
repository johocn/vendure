/* eslint-disable */
// 独立验证脚本：门店收银「收款确认」闭环（我的上门自提，非 vitest）
// 走真实 admin-api mutation：myPickupOrders(取本店待核销) → claimPickupByShop(确认收款核销)
// 用法：node -r ts-node/register verify-closed-loop.ts
import path from 'path';
import gql from 'graphql-tag';
import { defaultConfig, LanguageCode, mergeConfig, PaymentMethodHandler } from '@vendure/core';
import {
    createTestEnvironment,
    registerInitializer,
    SimpleGraphQLClient,
    SqljsInitializer,
} from '@vendure/testing';

import { initialData } from '../../e2e-common/e2e-initial-data';
import { ShopPlugin } from '@vendure/shop-plugin';
import { PickupPlugin } from '@vendure/pickup-plugin';

const OWNER_EMAIL = 'zhao@163.com';
const OWNER_PASSWORD = '23123';

// 单段结算测试收款：模拟「固定聚合码收款」的已支付（Settled）
const verifyPayment = new PaymentMethodHandler({
    code: 'verify-pickup-payment',
    description: [{ languageCode: LanguageCode.en, value: 'Verify Pickup' }],
    args: {},
    createPayment: (ctx, order, amount, args, metadata) => ({
        amount,
        state: 'Settled',
        transactionId: 'verify-12345',
        metadata,
    }),
    settlePayment: () => ({ success: true }),
});

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__verify_data__')));

export function buildConfig() {
    // 基于 @vendure/testing 的 defaultConfig（sqljs 内存库 + superadmin 等），只启闭环所需插件
    return mergeConfig(
        defaultConfig,
        {
            apiOptions: { port: 3310, adminApiPath: 'admin-api', shopApiPath: 'shop-api' },
            authOptions: { tokenMethod: 'bearer' },
            dbConnectionOptions: {
                type: 'sqljs',
                database: new Uint8Array([]),
                location: '',
                autoSave: false,
                logging: false,
            },
            paymentOptions: { paymentMethodHandlers: [verifyPayment] },
            plugins: [ShopPlugin.init({}), PickupPlugin.init({})],
        },
    ) as any;
}

async function main() {
    const config = buildConfig();
    const { server, adminClient, shopClient } = createTestEnvironment(config as any);
    const adminApiUrl = `http://localhost:${config.apiOptions.port}/${config.apiOptions.adminApiPath}`;

    // ---------- 准备 ----------
    await server.init({
        initialData: {
            ...initialData,
            paymentMethods: [
                { name: verifyPayment.code, handler: { code: verifyPayment.code, arguments: [] } },
            ],
        },
        productsCsvPath: path.join(__dirname, '../core/e2e/fixtures/e2e-products-minimal.csv'),
        customerCount: 1,
    });
    await (adminClient as SimpleGraphQLClient).asSuperAdmin();

    // 建店 + 店主账号 zhao@163.com / 23123（固定聚合码收银初始化）
    const shop = await adminClient.query(gql`
        mutation { createShop(input:{ name:"赵氏门店", slug: "zhaoshi-shop", description:"自提单验证店" }) { id name slug status } }
    `) as any;
    const shopId = shop.createShop.id;
    await adminClient.query(gql`
        mutation { setShopStatus(id:"${shopId}", status:"active") { id status } }
    `);
    await adminClient.query(gql`
        mutation {
            provisionShopOwner(shopId: "${shopId}", input: {
                emailAddress: "${OWNER_EMAIL}", password: "${OWNER_PASSWORD}", firstName:"赵", lastName:"店" }) { id }
        }
    `);

    // 买家（自提顾客）+ 归属本店的自提商品
    await adminClient.query(gql`
        mutation { createCustomer(input: { firstName:"顾", lastName:"客", emailAddress:"shopper.pickup@test.com" }, password:"test") { ... on Customer { id } } }
    `);
    const tax = (await adminClient.query(gql`query { taxCategories { items { id } } }`)) as any;
    const taxId = tax.taxCategories.items[0].id;
    const p = (await adminClient.query(gql`
        mutation { createProduct(input:{ translations:[{ languageCode: en, name:"自提靓货", slug:"pickup-good", description:"自提商品" }] }) { ... on Product { id } } }
    `)) as any;
    const pid = p.createProduct.id;
    const v = (await adminClient.query(gql`
        mutation {
            createProductVariants(input:[{ productId:"${pid}" sku:"pickup-good-x" price:18000
                taxCategoryId:"${taxId}" trackInventory:FALSE
                translations:[{ languageCode: en, name:"自提靓货 - 标准" }] }])
            { ... on ProductVariant { id } }
        }
    `)) as any;
    const variantId = v.createProductVariants[0].id;
    await adminClient.query(gql`
        mutation { assignProductsToShop(input:{ shopId:"${shopId}", productIds:["${pid}"] }) }
    `);

    // 顾客会话：加自提单 → 选自提 → 付款 → 备货(Shipped)
    await shopClient.asUserWithCredentials('shopper.pickup@test.com', 'test');
    const addRes = await shopClient.query(gql`
        mutation { addItemToOrder(productVariantId:"${variantId}", quantity:1) {
            ... on Order { id } ... on ErrorResult { errorCode message } } }
    `);
    await shopClient.query(gql`
        mutation { setOrderCustomFields(input:{ customFields:{ deliveryType:"pickup" } }) {
            ... on Order { id state } ... on ErrorResult { errorCode message } } }
    `);
    await shopClient.query(gql`
        mutation { setOrderShippingAddress(input:{ fullName:"顾客" streetLine1: "到店自提" postalCode:"000000" city:"北京" countryCode:"CN" }) { ... on Order { id } } }
    `);
    const shipMethods = (await shopClient.query(gql`query { eligibleShippingMethods { id code } }`)) as any;
    const sm = shipMethods.eligibleShippingMethods[0];
    await shopClient.query(gql`
        mutation { setOrderShippingMethod(shippingMethodId:"${sm.id}") { ... on Order { id } ... on ErrorResult { errorCode message } } }
    `);
    const trans = (await shopClient.query(gql`
        mutation { transitionOrderToState(state:"ArrangingPayment") {
            ... on Order { id state } ... on ErrorResult { errorCode message } } }
    `)) as any;
    const orderId = trans.transitionOrderToState.id as string;
    const paid = (await shopClient.query(gql`
        mutation { addPaymentToOrder(input:{ method:"${verifyPayment.code}", metadata:{ fixedAggregateCode:"PAY-FIX-001" } }) {
            ... on Order { id state totalWithTax }
            ... on ErrorResult { errorCode message } } }
    `)) as any;
    if (!paid.addPaymentToOrder || paid.addPaymentToOrder.errorCode) {
        throw new Error('付款失败: ' + JSON.stringify(paid.addPaymentToOrder ?? paid));
    }

    // 备货：addFulfillment(全行 manual-fulfillment) → Fulfillment Shipped → Order Shipped
    const detail = (await adminClient.query(gql`query { order(id:"${orderId}") { id state lines { id quantity } } }`)) as any;
    const lines = detail.order.lines.map((l: any) => `{ orderLineId:"${l.id}", quantity:${l.quantity} }`).join(' ');
    const f = (await adminClient.query(gql`
        mutation {
            addFulfillmentToOrder(input:{ lines:[${lines}]
                handler:{ code:"manual-fulfillment" arguments:[
                    { name:"method", value:"standard" } { name:"trackingCode", value:"PICKUP" } ] } })
            { ... on Fulfillment { id state } ... on ErrorResult { errorCode message } }
        }
    `)) as any;
    const fid = f.addFulfillmentToOrder.id;
    await adminClient.query(gql`mutation { transitionFulfillmentToState(id:"${fid}", state:"Shipped") { ... on Fulfillment { state } } }`);
    await adminClient.query(gql`mutation { transitionOrderToState(id:"${orderId}", state:"Shipped") { ... on Order { state } } }`);

    // 顾客取码（generated）
    const codeRes = (await shopClient.query(gql`
        query { myPickupCode(orderId:"${orderId}") { id code status } }
    `)) as any;
    const code = codeRes.myPickupCode.code;
    console.log('[数据] 自提单已就绪 订单#' + orderId + ' 应付分=' + paid.addPaymentToOrder.totalWithTax + ' 核销码=' + code);

    // ---------- POS 走账：店主 zhao@163.com / 23123 登录收银 ----------
    const owner = new SimpleGraphQLClient(config as any, adminApiUrl);
    await owner.asUserWithCredentials(OWNER_EMAIL, OWNER_PASSWORD);

    const list = (await owner.query(gql`query { myPickupOrders(options:{ take:100, skip:0 }) { items { id orderId orderCode code status } totalItems } }`)) as any;
    const hit = list.myPickupOrders.items.find((i: any) => String(i.orderId) === String(orderId));
    if (!hit) throw new Error('店主 myPickupOrders 未列出本店自提单 (orderId=' + orderId + ')');
    console.log('[POS] myPickupOrders 命中本店待核销单: 核销码=' + hit.code + ' status=' + hit.status);

    const claim = (await owner.query(gql`
        mutation { claimPickupByShop(code:"${code}") { id orderId code status claimChannel claimedAt } }
    `)) as any;
    console.log('[POS] claimPickupByShop 结果:', JSON.stringify(claim.claimPickupByShop));

    // 二次核销应被拒（一次性），证明闭环解除
    let retryRejected = false;
    try {
        await owner.query(gql`mutation { claimPickupByShop(code:"${code}") { id status } }`);
    } catch {
        retryRejected = true;
    }
    if (!retryRejected) throw new Error('重复核销未被拒，闭环未正确解除');

    // 核销后履约与订单标记
    const after = (await adminClient.query(gql`
        query { order(id:"${orderId}") { state fulfillments { state } customFields { pickupClaimed } } }
    `)) as any;
    const result = {
        redemptionId: claim.claimPickupByShop.id,
        orderCode: hit.orderCode,
        code,
        status: claim.claimPickupByShop.status,
        claimChannel: claim.claimPickupByShop.claimChannel,
        orderStateAfter: after.order.state,
        fulfillmentStates: after.order.fulfillments.map((f: any) => f.state),
        pickupClaimed: after.order.customFields?.pickupClaimed ?? null,
    };
    const ok =
        result.status === 'redeemed' &&
        result.claimChannel === 'shop' &&
        (result.orderStateAfter === 'PartiallyDelivered' || result.orderStateAfter === 'Delivered') &&
        result.fulfillmentStates.includes('Delivered') &&
        result.pickupClaimed === true;
    console.log('\n===== 收款确认闭环验证结果 =====');
    console.log(JSON.stringify(result, null, 2));
    console.log(ok ? '\n✅ 闭环 PASS：确认收款核销成功、履约达 Delivered、订单标记 pickupClaimed=true、核销码一次性失效' : '\n❌ 闭环 FAIL');

    await server.destroy();
    process.exit(ok ? 0 : 1);
}

main().catch(err => {
    console.error('run error', err);
    process.exit(2);
});