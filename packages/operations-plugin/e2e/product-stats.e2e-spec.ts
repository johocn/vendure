import { mergeConfig, Order, TransactionalConnection } from '@vendure/core';
import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { singleStageRefundablePaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';
import { addPaymentToOrder, proceedToArrangingPayment } from '../../core/e2e/utils/test-order-utils';
import { marketplaceCustomFields } from '../../marketplace-plugin/src/custom-fields';
import { OperationsPlugin } from '../src/operations.plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

/** 测试 EntityIdStrategy 会给 ID 加 `T_` 前缀；直连仓库查询需还原纯数字 id。 */
function numericId(encoded: string | number): number {
    return Number(String(encoded).replace(/^T_/, ''));
}

/** 让事件订阅触发的后台重算跑完，避免与本用例的显式重算互相干扰「返回更新数」的断言口径。 */
function settle(ms = 200): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe('OperationsPlugin · 商品销量/积分重算', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [OperationsPlugin.init()],
        paymentOptions: { paymentMethodHandlers: [singleStageRefundablePaymentMethod] },
    });
    // mergeConfig 对数组走「对象深合并」，Product 自定义字段会变成 `{"0":{...}}` 这种非数组结构；
    // 这里直接赋真实数组。字段定义仍复用 marketplace-plugin 的唯一来源，防字段名漂移。
    (config.customFields as any) = { Product: marketplaceCustomFields.Product };

    const { server, adminClient, shopClient } = createTestEnvironment(config);

    const customerEmail = 'stats.buyer@test.com';
    let productId: string;
    let variantId: string;
    let taxCategoryId: string;

    async function recompute(productIds?: string[]): Promise<number> {
        const res = (await adminClient.query(
            gql`
                mutation ($ids: [ID!]) {
                    recomputeProductStats(productIds: $ids)
                }
            `,
            { ids: productIds ?? null },
        )) as any;
        return res.recomputeProductStats as number;
    }

    async function readStats(pid: string = productId): Promise<any> {
        const res = (await adminClient.query(
            gql`
                query ($id: ID!) {
                    product(id: $id) {
                        customFields {
                            salesCount
                            realSalesCount
                            bonusSales
                            pointsReward
                            pointsRewardOverride
                        }
                    }
                }
            `,
            { id: pid },
        )) as any;
        return res.product.customFields;
    }

    async function createProduct(slug: string, sku: string, price: number): Promise<{ productId: string; variantId: string }> {
        const p = (await adminClient.query(gql`
            mutation {
                createProduct(input: {
                    translations: [{ languageCode: en, name: "${slug}", slug: "${slug}", description: "${slug}" }]
                }) { ... on Product { id } }
            }
        `)) as any;
        const pid = p.createProduct.id as string;
        const v = (await adminClient.query(gql`
            mutation {
                createProductVariants(input: [{
                    productId: "${pid}"
                    sku: "${sku}"
                    price: ${price}
                    taxCategoryId: "${taxCategoryId}"
                    trackInventory: FALSE
                    translations: [{ languageCode: en, name: "${sku}" }]
                }]) { ... on ProductVariant { id } }
            }
        `)) as any;
        return { productId: pid, variantId: v.createProductVariants[0].id as string };
    }

    async function addItem(quantity: number): Promise<void> {
        const res = (await shopClient.query(
            gql`
                mutation ($variantId: ID!, $qty: Int!) {
                    addItemToOrder(productVariantId: $variantId, quantity: $qty) {
                        ... on Order { id }
                        ... on ErrorResult { errorCode message }
                    }
                }
            `,
            { variantId, qty: quantity },
        )) as any;
        expect(res.addItemToOrder.errorCode).toBeUndefined();
    }

    async function currentActiveOrderId(): Promise<string> {
        const res = (await shopClient.query(gql`query { activeOrder { id } }`)) as any;
        return res.activeOrder.id as string;
    }

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
        });
        await adminClient.asSuperAdmin();

        const taxCats = (await adminClient.query(gql`query { taxCategories { items { id } } }`)) as any;
        taxCategoryId = taxCats.taxCategories.items[0].id;

        const created = await createProduct('stats-test-product', 'stats-v1', 9900);
        productId = created.productId;
        variantId = created.variantId;

        await adminClient.query(gql`
            mutation {
                createCustomer(input: { firstName: "Stats", lastName: "Buyer", emailAddress: "${customerEmail}" }, password: "test") { ... on Customer { id } }
            }
        `);
        await shopClient.asUserWithCredentials(customerEmail, 'test');
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('用例1 销量只计已支付及之后状态的订单（全渠道合计）', async () => {
        // 一笔真实已支付单：数量 2
        await addItem(2);
        await proceedToArrangingPayment(shopClient);
        const paid = await addPaymentToOrder(shopClient, singleStageRefundablePaymentMethod);
        expect(String(paid.id)).toBeTruthy();

        // 另一笔活动单：数量 5 → 直接改库置为 Cancelled。
        // 本用例聚焦「聚合口径（state 白名单）」，不依赖订单状态机与退款流程。
        await addItem(5);
        const activeOrderId = await currentActiveOrderId();
        const connection = server.app.get(TransactionalConnection);
        await connection.rawConnection.getRepository(Order).update(numericId(activeOrderId), { state: 'Cancelled' as any });

        expect(await recompute([productId])).toBe(1);

        const stats = await readStats();
        expect(stats.realSalesCount).toBe(2);
        expect(stats.salesCount).toBe(2);
        // 9900 分 = ¥99；1 分 = 1 积分（Channel.pointsPerYuan 默认 100），故派生值即 9900
        expect(stats.pointsReward).toBe(9900);
    });

    it('用例2 展示销量 = 真实销量 + 后台基数；用例4 重算幂等', async () => {
        await adminClient.query(gql`
            mutation {
                updateProduct(input: { id: "${productId}", customFields: { bonusSales: 100 } }) { id }
            }
        `);
        await settle();
        // 显式重算：本用例校验「写回公式」本身，不依赖事件订阅（订阅的即时生效由用例6 单独覆盖）。
        // 订阅上线后这里会退化为 no-op（返回 0），故不断言其返回值。
        await recompute([productId]);

        let stats = await readStats();
        expect(stats.realSalesCount).toBe(2);
        expect(stats.salesCount).toBe(102);

        // 幂等：值已收敛后，连续重算都不再写库
        await recompute([productId]);
        expect(await recompute([productId])).toBe(0);
        stats = await readStats();
        expect(stats.salesCount).toBe(102);
    });

    it('用例3 可得积分：无覆盖按最低变体价派生，有覆盖取覆盖值', async () => {
        let stats = await readStats();
        expect(stats.pointsReward).toBe(9900);

        await adminClient.query(gql`
            mutation {
                updateProduct(input: { id: "${productId}", customFields: { pointsRewardOverride: 500 } }) { id }
            }
        `);
        await settle();
        // 同上：显式重算保证本用例只校验「覆盖值优先」这一条口径。
        await recompute([productId]);

        stats = await readStats();
        expect(stats.pointsReward).toBe(500);
    });

    it('用例5 全量重算覆盖多商品并收敛', async () => {
        const second = await createProduct('stats-test-product-2', 'stats-v2', 1000);
        await settle();

        await recompute(); // 不带 productIds = 全量重算

        const first = await readStats();
        const secondStats = await readStats(second.productId);
        expect(first.salesCount).toBe(102);
        expect(first.pointsReward).toBe(500);
        expect(secondStats.salesCount).toBe(0);
        expect(secondStats.pointsReward).toBe(1000);

        // 已收敛 → 全量重算不再写任何商品
        expect(await recompute()).toBe(0);
    });

    it('用例6 后台改基数后无需手动重算即生效（事件订阅）', async () => {
        await adminClient.query(gql`
            mutation {
                updateProduct(input: { id: "${productId}", customFields: { bonusSales: 7 } }) { id }
            }
        `);
        await settle();

        const stats = await readStats();
        expect(stats.salesCount).toBe(9); // realSalesCount 2 + bonusSales 7
    });
});
