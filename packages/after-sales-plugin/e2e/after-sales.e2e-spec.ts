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
import {
    singleStageRefundFailingPaymentMethod,
    singleStageRefundablePaymentMethod,
    testSuccessfulPaymentMethod,
} from '../../core/e2e/fixtures/test-payment-methods';
import { addPaymentToOrder, proceedToArrangingPayment } from '../../core/e2e/utils/test-order-utils';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('AfterSalesPlugin · 售后退款/回补入账本闭环', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [AfterSalesPlugin.init(), InventoryPlugin.init(), LogisticsPlugin.init()],
            paymentOptions: {
                // 主支付方式用可退款的单段处理器：processor.createRefund 直接返回 Settled（真实网关路径）
                paymentMethodHandlers: [
                    singleStageRefundablePaymentMethod,
                    singleStageRefundFailingPaymentMethod,
                    testSuccessfulPaymentMethod,
                ],
            },
        }),
    );

    let nearLocId: string;
    let farLocId: string;
    let variantId: string;
    let orderLineId: string;
    let orderId: string;
    let mainAsId: string;

    beforeAll(async () => {
        await server.init({
            initialData: {
                ...initialData,
                paymentMethods: [
                    {
                        name: singleStageRefundablePaymentMethod.code,
                        handler: { code: singleStageRefundablePaymentMethod.code, arguments: [] },
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
        const paidOrder = await addPaymentToOrder(shopClient, singleStageRefundablePaymentMethod);
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
        mainAsId = asId;
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

        // 7. 退款关闭：processAfterSalesRefund → AfterSalesRequest Refunded + Refund 达 Settled（钱真正退回）
        const refunded = await adminClient.query(gql`
            mutation { processAfterSalesRefund(id: "${asId}") { id state refundAmount actualRefundAmount refundTransactionId refundedAt } }
        `);
        const r = refunded.processAfterSalesRefund;
        expect(r.state).toBe('Refunded');
        expect(r.actualRefundAmount).toBeGreaterThan(0);
        expect(r.refundTransactionId).toBeTruthy();
        expect(r.refundedAt).toBeTruthy();
        // 底层 Vendure Refund 必须是 Settled 终态（非假退款 Pending）
        const refundsOnOrder = await adminClient.query(gql`
            query { order(id: "${orderId}") { payments { id refunds { id state total } } } }
        `);
        const refunds = refundsOnOrder.order.payments.flatMap((p: any) => p.refunds);
        expect(refunds.length).toBeGreaterThan(0);
        expect(refunds.every((f: any) => f.state === 'Settled')).toBe(true);
    }, TEST_SETUP_TIMEOUT_MS);

    it('退款失败 → RefundFailed → 重试成功 → Refunded（退款闭环可重试）', async () => {
        // 专用订单：用「首退失败、重试成功」处理器，模拟退款网关第一次失败、重试成功
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
        const addResult = await shopClient.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantId}", quantity: 1) {
                    ... on Order { id code state totalWithTax }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);
        const failOrderId = addResult.addItemToOrder.id;
        expect(failOrderId).toBeDefined();
        await shopClient.query(gql`
            mutation {
                setOrderCustomFields(input: { customFields: { lat: 30.66, lng: 104.06, city: "成都" } }) {
                    ... on Order { id }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);
        await proceedToArrangingPayment(shopClient);
        // 创建一张挂载「首退失败」处理器的支付方式，并支付
        await adminClient.query(gql`
            mutation {
                createPaymentMethod(input: {
                    code: "${singleStageRefundFailingPaymentMethod.code}"
                    enabled: true
                    translations: [{ languageCode: zh_Hans, name: "${singleStageRefundFailingPaymentMethod.code}" }]
                    handler: { code: "${singleStageRefundFailingPaymentMethod.code}" arguments: [] }
                }) { id code }
            }
        `);
        const paid = await addPaymentToOrder(shopClient, singleStageRefundFailingPaymentMethod);
        expect(paid.id).toBeDefined();

        // 发货推进到 Shipped（与主测试相同的 fulfillment 链路）
        const detail = await adminClient.query(gql`
            query { order(id: "${failOrderId}") { id state lines { id quantity } } }
        `);
        const fl = detail.order.lines[0];
        const fulfillment = await adminClient.query(gql`
            mutation {
                addFulfillmentToOrder(input: {
                    lines: [{ orderLineId: "${fl.id}", quantity: ${fl.quantity} }]
                    handler: {
                        code: "manual-fulfillment"
                        arguments: [
                            { name: "method", value: "standard" }
                            { name: "trackingCode", value: "SF_RETRY" }
                        ]
                    }
                }) { ... on Fulfillment { id } ... on ErrorResult { errorCode message } }
            }
        `);
        const fId = fulfillment.addFulfillmentToOrder.id;
        await adminClient.query(gql`
            mutation { transitionFulfillmentToState(id: "${fId}", state: "Shipped") { ... on Fulfillment { id state } } }
        `);
        await adminClient.query(gql`
            mutation { transitionOrderToState(id: "${failOrderId}", state: "Shipped") { ... on Order { id state } } }
        `);

        // Shipped 订单发起售后（return_refund），走完整 Pending→Approved→Returning→Received
        const created = await shopClient.query(gql`
            mutation {
                createAfterSalesRequest(input: {
                    orderId: "${failOrderId}"
                    type: return_refund
                    reason: "e2e-refund-fail"
                    refundAmount: 1
                }) { id state }
            }
        `);
        const asId = created.createAfterSalesRequest.id;
        expect(created.createAfterSalesRequest.state).toBe('Pending');
        await adminClient.query(gql`
            mutation { approveAfterSalesRequest(id: "${asId}") { id } }
        `);
        await shopClient.query(gql`
            mutation { updateReturnTracking(id: "${asId}", trackingNo: "SF123", carrier: "顺丰") { id state } }
        `);
        await adminClient.query(gql`
            mutation { confirmReturnReceived(id: "${asId}") { id state } }
        `);
        // 第一次退款失败 → RefundFailed（网关首退返回 Failed）
        const failed = await adminClient.query(gql`
            mutation { processAfterSalesRefund(id: "${asId}") { id state refundError } }
        `);
        expect(failed.processAfterSalesRefund.state).toBe('RefundFailed');
        expect(failed.processAfterSalesRefund.refundError).toBeTruthy();
        // 重试成功 → Refunded
        const retried = await adminClient.query(gql`
            mutation { retryAfterSalesRefund(id: "${asId}") { id state } }
        `);
        expect(retried.retryAfterSalesRefund.state).toBe('Refunded');
    }, TEST_SETUP_TIMEOUT_MS);

    it('Admin 类型暴露 order / orderLine / customer 只读嵌套字段', async () => {
        // 复用第 1 个用例已创建的售后单：列表取一条即可（findAll 已预加载 relations）
        const res = await adminClient.query(gql`
            query {
                afterSalesRequests(options: { take: 1 }) {
                    items {
                        id
                        state
                        order { id code }
                        orderLine { id quantity }
                        customer { id firstName lastName }
                    }
                }
            }
        `);
        const row = res.afterSalesRequests.items[0];
        expect(row).toBeDefined();
        expect(row.order?.code).toBeTruthy();
        expect(row.orderLine?.id).toBeTruthy();
        expect(row.customer?.id).toBeTruthy();
    }, TEST_SETUP_TIMEOUT_MS);

    const PNG_1PX =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

    it('uploadAfterSalesEvidence：未登录被拒 / 合法图片返回 URL / 非法类型与超大图片被拒', async () => {
        // 1. 未登录（新开一个匿名 shopClient 状态）
        await shopClient.asAnonymousUser();
        await expect(
            shopClient.query(gql`
                mutation {
                    uploadAfterSalesEvidence(images: ["${PNG_1PX}"])
                }
            `),
        ).rejects.toThrow();

        // 2. 登录后：合法图片 → 返回 1 条非空 URL
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
        const ok = await shopClient.query(gql`
            mutation {
                uploadAfterSalesEvidence(images: ["${PNG_1PX}"])
            }
        `);
        expect(ok.uploadAfterSalesEvidence).toHaveLength(1);
        expect(typeof ok.uploadAfterSalesEvidence[0]).toBe('string');
        expect(ok.uploadAfterSalesEvidence[0].length).toBeGreaterThan(0);

        // 3. 非法 MIME（gif 不在白名单）
        const badMime = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';
        await expect(
            shopClient.query(gql`
                mutation {
                    uploadAfterSalesEvidence(images: ["${badMime}"])
                }
            `),
        ).rejects.toThrow();

        // 4. 单张解码后 > 5MB
        const huge = `data:image/png;base64,${Buffer.alloc(5 * 1024 * 1024 + 1024).toString('base64')}`;
        await expect(
            shopClient.query(gql`
                mutation {
                    uploadAfterSalesEvidence(images: ["${huge}"])
                }
            `),
        ).rejects.toThrow();
    }, TEST_SETUP_TIMEOUT_MS);

    it('状态历史：单查 afterSalesRequestAdmin 返回逐节点 history，含 order/customer', async () => {
        const single = await adminClient.query(gql`
            query {
                afterSalesRequestAdmin(id: "${mainAsId}") {
                    id state
                    history { fromState toState createdAt }
                    order { id code }
                    customer { id }
                }
            }
        `);
        const row = single.afterSalesRequestAdmin;
        expect(row).toBeDefined();
        expect(row.history.map((h: any) => h.toState)).toEqual([
            'Pending', 'Approved', 'Returning', 'Received', 'Refunded',
        ]);
        expect(row.history[0].fromState).toBeNull();
        expect(row.history[0].createdAt).toBeTruthy();
        expect(row.order?.code).toBeTruthy();
        expect(row.customer?.id).toBeTruthy();
    }, TEST_SETUP_TIMEOUT_MS);

    it('Shop 详情 history：顾客端 afterSalesRequest 返回 history', async () => {
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
        const res = await shopClient.query(gql`
            query { afterSalesRequest(id: "${mainAsId}") { id state history { toState createdAt } } }
        `);
        expect(res.afterSalesRequest.history.length).toBeGreaterThanOrEqual(5);
    }, TEST_SETUP_TIMEOUT_MS);

    it('批量操作：整单查重 + 全成功 / 部分失败（非法id+非法状态）/ 超 50 拒绝', async () => {
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
        // 新规则：整单售后按订单查重（非 Closed 均占用）→ 主订单已 Refunded 被占用，需新建 Shipped 订单
        const addResult = await shopClient.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantId}", quantity: 1) {
                    ... on Order { id }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);
        const batchOrderId = addResult.addItemToOrder.id;
        expect(batchOrderId).toBeDefined();
        await shopClient.query(gql`
            mutation {
                setOrderCustomFields(input: { customFields: { lat: 30.66, lng: 104.06, city: "成都" } }) {
                    ... on Order { id }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);
        await proceedToArrangingPayment(shopClient);
        await addPaymentToOrder(shopClient, singleStageRefundablePaymentMethod);
        const bd = await adminClient.query(gql`
            query { order(id: "${batchOrderId}") { id state lines { id quantity } } }
        `);
        const bl = bd.order.lines[0];
        const bf = await adminClient.query(gql`
            mutation {
                addFulfillmentToOrder(input: {
                    lines: [{ orderLineId: "${bl.id}", quantity: ${bl.quantity} }]
                    handler: {
                        code: "manual-fulfillment"
                        arguments: [
                            { name: "method", value: "standard" }
                            { name: "trackingCode", value: "SF_BATCH" }
                        ]
                    }
                }) { ... on Fulfillment { id } ... on ErrorResult { errorCode message } }
            }
        `);
        await adminClient.query(gql`
            mutation { transitionFulfillmentToState(id: "${bf.addFulfillmentToOrder.id}", state: "Shipped") { ... on Fulfillment { id state } } }
        `);
        await adminClient.query(gql`
            mutation { transitionOrderToState(id: "${batchOrderId}", state: "Shipped") { ... on Order { id state } ... on ErrorResult { errorCode message } } }
        `);

        const c = await shopClient.query(gql`
            mutation {
                createAfterSalesRequest(input: { orderId: "${batchOrderId}", type: refund_only, reason: "batch-0", refundAmount: 1 }) { id state }
            }
        `);
        const firstId = c.createAfterSalesRequest.id;
        // 整单查重：同订单再提整单售后被拒（旧规则允许同单多张，现按 spec 收紧）
        await expect(shopClient.query(gql`
            mutation {
                createAfterSalesRequest(input: { orderId: "${batchOrderId}", type: refund_only, reason: "batch-dup", refundAmount: 1 }) { id state }
            }
        `)).rejects.toThrow(/already exists/);
        // 批量同意全成功
        const approved = await adminClient.query(gql`
            mutation { batchApproveAfterSalesRequests(ids: ["${firstId}"]) { id success state message } }
        `);
        expect(approved.batchApproveAfterSalesRequests.every((r: any) => r.success && r.state === 'Approved')).toBe(true);
        // 批量拒绝部分失败：混入非法 id + 已 Approved 的 id（返回按输入顺序）
        const mixed = await adminClient.query(gql`
            mutation { batchRejectAfterSalesRequests(ids: ["999999", "${firstId}"], reason: "e2e-batch-reject") { id success state message } }
        `);
        // 注意：返回的 id 经 Vendure IdCodec 全局编码，'999999' 这类裸数字键对不上，按输入顺序断言
        const rejResults = mixed.batchRejectAfterSalesRequests;
        expect(rejResults).toHaveLength(2);
        expect(rejResults[0].success).toBe(false); // '999999' 不存在
        expect(rejResults[0].message).toBeTruthy();
        expect(rejResults[1].success).toBe(false); // Approved 不可 reject
        // 超 50 条：后端 UserInputError
        const tooMany = Array.from({ length: 51 }, (_, i) => `"${i + 1}"`).join(', ');
        await expect(
            adminClient.query(gql`
                mutation { batchApproveAfterSalesRequests(ids: [${tooMany}]) { id success } }
            `),
        ).rejects.toThrow();
    }, TEST_SETUP_TIMEOUT_MS);

    it('退货地址：未登录 Shop 被拒 / Admin 写读回环 / Shop 只读', async () => {
        // 1. 未登录被拒
        await shopClient.asAnonymousUser();
        await expect(shopClient.query(gql`query { afterSalesReturnAddress }`)).rejects.toThrow();
        // 2. Admin 写 → 读回环
        await adminClient.query(gql`
            mutation { updateAfterSalesReturnAddress(address: "四川省成都市武侯区售后仓 1 号楼") }
        `);
        const adminRead = await adminClient.query(gql`query { afterSalesReturnAddress }`);
        expect(adminRead.afterSalesReturnAddress).toBe('四川省成都市武侯区售后仓 1 号楼');
        // 3. Shop 登录只读一致
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
        const shopRead = await shopClient.query(gql`query { afterSalesReturnAddress }`);
        expect(shopRead.afterSalesReturnAddress).toBe('四川省成都市武侯区售后仓 1 号楼');
    }, TEST_SETUP_TIMEOUT_MS);
});
