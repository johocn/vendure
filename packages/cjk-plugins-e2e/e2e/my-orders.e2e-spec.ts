import { createTestEnvironment } from '@vendure/testing';
import { configureDefaultOrderProcess } from '@vendure/core';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CjkPlugin } from '@vendure/cjk-plugin';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';

// 测试库无「配送档案」→ BoxShippingLineAssignmentStrategy 无法把订单行分箱到 ShippingLine，
// 会导致 setShippingMethod 后 shippingLines 为空、无法推进到 ArrangingPayment。
// 本用例只关心 myOrders 列表本身，故关闭 shipping 前置校验（与 POS e2e 同做法）。
const myOrdersOrderProcess = configureDefaultOrderProcess({
    arrangingPaymentRequiresShipping: false,
});

/**
 * 覆盖 C 端「我的订单」列表 shop 查询 `myOrders`：
 * ① 传 options 能拿到 items/totalItems；
 * ② 不传 options 也不报错；
 * ③ 正在编辑的购物车单（AddingItems）被排除；
 * ④ 换第二个顾客登录后查不到第一个顾客的订单（防串号）。
 */
describe('CJK myOrders (shop)', () => {
    const baseConfig = testConfig();
    const { server, adminClient, shopClient } = createTestEnvironment({
        ...baseConfig,
        // 复用 core 的 fixtures 目录，避免测试用例目录下缺少商品图片资源
        importExportOptions: {
            ...baseConfig.importExportOptions,
            importAssetsDir: path.join(__dirname, '../../core/e2e/fixtures/assets'),
        },
        orderOptions: {
            ...baseConfig.orderOptions,
            process: [myOrdersOrderProcess],
        },
        plugins: [
            CjkPlugin.init({
                i18n: { enabled: true },
                regions: { enabled: true },
                tenant: { enabled: true },
            }),
        ],
    });

    // PostgresInitializer 每次运行都会 DROP/CREATE 独立数据库，故固定邮箱不会冲突；
    // sqljs 首次运行后复用 .sqlite（邮箱唯一性由测试库生命周期保证）。
    const emailA = 'myorders-a@test.com';
    const emailB = 'myorders-b@test.com';

    let variantId: string;
    let orderAId: string;

    beforeAll(async () => {
        await server.init({
            initialData: {
                ...initialData,
                paymentMethods: [],
            },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();

        for (const email of [emailA, emailB]) {
            await adminClient.query(gql`
                mutation {
                    createCustomer(
                        input: { firstName: "My", lastName: "Orders", emailAddress: "${email}" }
                        password: "test"
                    ) {
                        ... on Customer { id emailAddress }
                        ... on ErrorResult { errorCode message }
                    }
                }
            `);
        }

        const products = await adminClient.query(gql`
            query { products(options: { take: 1 }) { items { variants { id } } } }
        `);
        variantId = products.products.items[0].variants[0].id;
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('① 顾客 A 下单后，myOrders(options) 返回该订单', async () => {
        await shopClient.asUserWithCredentials(emailA, 'test');

        const addResult = await shopClient.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantId}", quantity: 1) {
                    ... on Order { id state }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);
        expect(addResult.addItemToOrder.id).toBeDefined();

        const transition = await shopClient.query(gql`
            mutation {
                transitionOrderToState(state: "ArrangingPayment") {
                    ... on Order { id state }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);
        expect(transition.transitionOrderToState.state).toBe('ArrangingPayment');

        const res = await shopClient.query(gql`
            query {
                myOrders(options: { take: 5 }) {
                    items { id code state totalQuantity totalWithTax }
                    totalItems
                }
            }
        `);
        expect(res.myOrders.totalItems).toBeGreaterThanOrEqual(1);
        expect(res.myOrders.items.length).toBeGreaterThanOrEqual(1);
        expect(res.myOrders.items[0].state).toBe('ArrangingPayment');
        orderAId = res.myOrders.items[0].id;
    }, 60000);

    it('② 不传 options 也不报错', async () => {
        await shopClient.asUserWithCredentials(emailA, 'test');
        const res = await shopClient.query(gql`
            query { myOrders { items { id state } totalItems } }
        `);
        expect(res.myOrders).toBeDefined();
        expect(res.myOrders.totalItems).toBeGreaterThanOrEqual(1);
    }, 30000);

    it('③ 正在编辑的购物车单（AddingItems）不出现在我的订单', async () => {
        await shopClient.asUserWithCredentials(emailA, 'test');
        await shopClient.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantId}", quantity: 1) {
                    ... on Order { id state }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);

        const res = await shopClient.query(gql`
            query {
                myOrders(options: { take: 20 }) { items { id state } totalItems }
            }
        `);
        // 下单的 ArrangingPayment 单仍在，但活动购物车单（AddingItems）被排除
        expect(res.myOrders.items.every((o: any) => o.state !== 'AddingItems')).toBe(true);
        expect(res.myOrders.items.some((o: any) => o.id === orderAId)).toBe(true);
    }, 30000);

    it('④ 顾客 B 看不到顾客 A 的订单（防串号）', async () => {
        await shopClient.asUserWithCredentials(emailB, 'test');
        const res = await shopClient.query(gql`
            query {
                myOrders(options: { take: 5 }) { items { id } totalItems }
            }
        `);
        expect(res.myOrders.totalItems).toBe(0);
        expect(res.myOrders.items).toEqual([]);
    }, 30000);

    // 回归：vshop 的 ORDER_FRAGMENT 依赖 taxSummary / discounts / shippingMethod / options 等
    // 需要额外 join 的字段。只查 id/state 的用例无法发现「服务端关系漏 join」——
    // 漏了 surcharges 会让整条查询返回 INTERNAL_SERVER_ERROR，前端只表现为「暂无订单」。
    it('⑤ 前端 ORDER_FRAGMENT 的字段都能取到（taxSummary/discounts/shippingMethod/options）', async () => {
        await shopClient.asUserWithCredentials(emailA, 'test');
        const res = await shopClient.query(gql`
            query {
                myOrders(options: { take: 5 }) {
                    totalItems
                    items {
                        id
                        code
                        state
                        totalQuantity
                        subTotalWithTax
                        totalWithTax
                        shippingWithTax
                        taxSummary {
                            description
                            taxRate
                            taxTotal
                        }
                        currencyCode
                        createdAt
                        lines {
                            id
                            quantity
                            linePriceWithTax
                            unitPriceWithTax
                            featuredAsset {
                                preview
                            }
                            productVariant {
                                id
                                productId
                                name
                                enabled
                                stockLevel
                                options {
                                    name
                                }
                            }
                        }
                        shippingAddress {
                            fullName
                            streetLine1
                        }
                        shippingLines {
                            priceWithTax
                            shippingMethod {
                                id
                                name
                                code
                            }
                        }
                        payments {
                            id
                            method
                            amount
                            state
                        }
                        couponCodes
                        discounts {
                            description
                            amountWithTax
                        }
                    }
                }
            }
        `);
        const order = res.myOrders.items[0];
        expect(order).toBeDefined();
        expect(Array.isArray(order.taxSummary)).toBe(true);
        expect(Array.isArray(order.discounts)).toBe(true);
        expect(Array.isArray(order.lines)).toBe(true);
        expect(order.lines[0].productVariant.productId).toBeDefined();
        expect(typeof order.lines[0].productVariant.enabled).toBe('boolean');
    }, 30000);
});
