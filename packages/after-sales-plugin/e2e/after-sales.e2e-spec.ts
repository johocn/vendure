import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { LanguageCode, mergeConfig } from '@vendure/core';
import {
    defaultShippingCalculator,
    defaultShippingEligibilityChecker,
    manualFulfillmentHandler,
} from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { AfterSalesPlugin } from '../src/plugin';
import { InventoryPlugin } from '@vendure/inventory-plugin';
import { LogisticsPlugin } from '@vendure/logistics-plugin';
import { testSuccessfulPaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';
import { addPaymentToOrder, proceedToArrangingPayment } from '../../core/e2e/utils/test-order-utils';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('AfterSalesPlugin · 售后退货回补入账本', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [AfterSalesPlugin.init(), InventoryPlugin.init(), LogisticsPlugin.init()],
            paymentOptions: {
                paymentMethodHandlers: [testSuccessfulPaymentMethod],
            },
        }),
    );

    let nearLocId: string;
    let farLocId: string;
    let variantId: string;
    let orderLineId: string;
    let orderId: string;

    beforeAll(async () => {
        await server.init({
            initialData: {
                ...initialData,
                paymentMethods: [
                    {
                        name: testSuccessfulPaymentMethod.code,
                        handler: { code: testSuccessfulPaymentMethod.code, arguments: [] },
                    },
                ],
            },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();

        // 准备两个带坐标的仓库：近仓（成都）与远仓（北京）
        const near = await adminClient.query(gql`
            mutation {
                createStockLocation(input: {
                    name: "成都仓"
                    customFields: { lat: 30.66, lng: 104.06, serviceCities: ["成都"] }
                }) { id name }
            }
        `);
        const far = await adminClient.query(gql`
            mutation {
                createStockLocation(input: {
                    name: "北京仓"
                    customFields: { lat: 39.9, lng: 116.4, serviceCities: ["北京"] }
                }) { id name }
            }
        `);
        nearLocId = near.createStockLocation.id;
        farLocId = far.createStockLocation.id;

        // 关键：新仓库未关联渠道，MultiChannelStockLocationStrategy 分配时会跳过它们，
        // 导致下单始终分配到默认 Primary 仓。必须用 assignStockLocationsToChannel 关联默认渠道。
        const channels = await adminClient.query(gql`
            query { channels { items { id code } } }
        `);
        const defaultChannelId = channels.channels.items[0].id;
        for (const locId of [nearLocId, farLocId]) {
            await adminClient.query(gql`
                mutation {
                    assignStockLocationsToChannel(input: {
                        stockLocationIds: ["${locId}"]
                        channelId: "${defaultChannelId}"
                    }) { id name }
                }
            `);
        }

        // 给近仓补足库存（变体 T_1）
        const products = await adminClient.query(gql`
            query { products(options: { take: 1 }) { items { id variants { id sku } } } }
        `);
        variantId = products.products.items[0].variants[0].id;

        // 关键：把所有仓的该变体库存清零，只保留成都仓有货，
        // 确保下单分配时唯一可分配的仓是成都仓（原发货仓 = 成都仓）。
        // CSV 变体默认 trackInventory=false（库存不追踪），会导致 quantityAvailable=MAX_SAFE_INTEGER，
        // 分配永远落在第一个仓。必须先为变体开启库存追踪与库存阈值。
        await adminClient.query(gql`
            mutation {
                updateProductVariants(input: [{
                    id: "${variantId}"
                    trackInventory: TRUE
                    outOfStockThreshold: 0
                    useGlobalOutOfStockThreshold: false
                }]) { id }
            }
        `);
        const allLocs = await adminClient.query(gql`
            query { stockLocations { items { id name } } }
        `);
        for (const loc of allLocs.stockLocations.items) {
            await adminClient.query(gql`
                mutation {
                    setVariantStock(
                        productVariantId: "${variantId}"
                        stockLocationId: "${loc.id}"
                        stockOnHand: ${String(loc.id) === nearLocId ? 100 : 0}
                    )
                }
            `);
        }
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('插件可加载', () => {
        expect(server.app).toBeDefined();
    });

    it('售后退货回补入账本：下单→发货→售后→confirmReceive 回补库存并写 afterSales 账本', async () => {
        // 1. shop 用户下单，定位成都（就近分配到成都仓并写入 orderLine.stockLocationId）
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');

        // 先加购创建活动订单，再设置订单定位（成都）。
        // 注意：NearestStockLocationStrategy 在 addItemToOrder 分配时读取订单经纬度；
        // 由于唯一有货仓是成都仓，即使无定位也能唯一分配到成都仓。
        const addResult = await shopClient.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantId}", quantity: 2) {
                    ... on Order { id code state totalWithTax }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);
        expect(addResult.addItemToOrder.id).toBeDefined();

        await shopClient.query(gql`
            mutation {
                setOrderCustomFields(input: { customFields: { lat: 30.66, lng: 104.06, city: "成都" } }) {
                    ... on Order { id }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);

        await proceedToArrangingPayment(shopClient);
        const paidOrder = await addPaymentToOrder(shopClient, testSuccessfulPaymentMethod);
        orderId = paidOrder.id;
        expect(orderId).toBeDefined();

        // 2. admin 发货：创建 fulfillment（manual）并推进订单到 Shipped
        const orderDetail = await adminClient.query(gql`
            query { order(id: "${orderId}") { id state lines { id quantity customFields { stockLocationId } } } }
        `);
        const line = orderDetail.order.lines[0];
        orderLineId = line.id;
        // 分配落在成都仓。成都仓是第 2 个创建的仓库（紧跟默认仓之后），实体内部 ID=2；
        // persistAllocationLocation 存的是实体内部 ID（String(chosen.location.id)），
        // 而非 GraphQL 编码 ID（T_2），此处断言内部 ID '2'。
        expect(line.customFields.stockLocationId).toBe('2');

        const fulfillment = await adminClient.query(gql`
            mutation {
                addFulfillmentToOrder(input: {
                    lines: [{ orderLineId: "${orderLineId}", quantity: ${line.quantity} }]
                    handler: {
                        code: "manual-fulfillment"
                        arguments: [
                            { name: "method", value: "standard" }
                            { name: "trackingCode", value: "SF123456" }
                        ]
                    }
                }) { ... on Fulfillment { id state } ... on ErrorResult { errorCode message } }
            }
        `);
        expect(fulfillment.addFulfillmentToOrder.id).toBeDefined();
        // 关键：默认订单状态机的 Shipped 前置守卫要求所有订单条目都处于 Shipped 的 fulfillment 中。
        // 因此必须先显式将 fulfillment 从 Pending 推进到 Shipped，订单才能过渡到 Shipped。
        const fulfillmentId = fulfillment.addFulfillmentToOrder.id;
        const transit = await adminClient.query(gql`
            mutation { transitionFulfillmentToState(id: "${fulfillmentId}", state: "Shipped") { ... on Fulfillment { id state } ... on ErrorResult { errorCode message } } }
        `);
        const shipped = await adminClient.query(gql`
            mutation { transitionOrderToState(id: "${orderId}", state: "Shipped") { ... on Order { id state } ... on ErrorResult { errorCode message } } }
        `);
        // 状态转换结果可能以不同字段返回，用 order(id) 复核实际状态
        const orderAfterShip = await adminClient.query(gql`
            query { order(id: "${orderId}") { id state } }
        `);
        expect(orderAfterShip.order.state).toBe('Shipped');

        // 记录发货后近仓库存水位
        const beforeLevels = await adminClient.query(gql`
            query { stockLevels(locationId: "${nearLocId}") { items { productVariantId stockOnHand } } }
        `);
        const beforeOnHand = beforeLevels.stockLevels.items.find(
            (l: any) => String(l.productVariantId) === String(variantId),
        )?.stockOnHand;
        expect(beforeOnHand).toBeDefined();

        // 3. shop 用户创建售后单（退货退款）
        const created = await shopClient.query(gql`
            mutation {
                createAfterSalesRequest(input: {
                    orderId: "${orderId}"
                    orderLineId: "${orderLineId}"
                    type: return_refund
                    reason: "e2e-return"
                    refundAmount: 100
                }) { id state orderLineId refundAmount }
            }
        `);
        const asId = created.createAfterSalesRequest.id;
        expect(created.createAfterSalesRequest.state).toBe('Pending');
        // 注意：asId 是 GraphQL 编码 ID（如 T_1），而账本 bizCode 存的是实体数字 ID（AS1）。
        // 账本查询/断言必须用数字 ID；mutation 参数继续用编码 ID。
        const asNumId = asId.replace(/^T_/, '');

        // 4. admin 审批 → shop 回填退货物流（Returning）→ admin 确认收货（Received，触发库存回补）
        await adminClient.query(gql`
            mutation { approveAfterSalesRequest(id: "${asId}") { id state } }
        `);
        await shopClient.query(gql`
            mutation { updateReturnTracking(id: "${asId}", trackingNo: "SF123", carrier: "顺丰") { id state } }
        `);
        const received = await adminClient.query(gql`
            mutation { confirmReturnReceived(id: "${asId}", receivedQuantity: 2) { id state receivedQuantity } }
        `);
        expect(received.confirmReturnReceived.state).toBe('Received');
        expect(received.confirmReturnReceived.receivedQuantity).toBe(2);

        // 5. 校验库存回补：近仓 stockOnHand 增加 2（部分/全额回补到原发货仓）
        const afterLevels = await adminClient.query(gql`
            query { stockLevels(locationId: "${nearLocId}") { items { productVariantId stockOnHand } } }
        `);
        const afterOnHand = afterLevels.stockLevels.items.find(
            (l: any) => String(l.productVariantId) === String(variantId),
        )?.stockOnHand;
        expect(afterOnHand).toBe(beforeOnHand + 2);

        // 6. 校验账本：afterSales 入账一条 in 流水，bizCode=AS<数字ID>，指向原发货仓
        const led = await adminClient.query(gql`
            query { stockLedger(bizType: "afterSales", bizCode: "AS${asNumId}") { items { direction quantity stockLocationId orderLineId bizType bizCode reason } totalItems } }
        `);
        expect(led.stockLedger.totalItems).toBe(1);
        expect(led.stockLedger.items[0]).toMatchObject({
            direction: 'in',
            quantity: 2,
            stockLocationId: nearLocId,
            orderLineId: orderLineId,
            bizType: 'afterSales',
            bizCode: `AS${asNumId}`,
        });
        expect(led.stockLedger.items[0].reason).toContain('AfterSales');
    }, TEST_SETUP_TIMEOUT_MS);
});
