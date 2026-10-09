import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { singleStageRefundablePaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';
// 引用 lib 编译产物（避免 @vendure/core 双实例，同 vcash-pos member-pricing e2e 口径）
import { MemberLevelPlugin } from '../lib/index';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

/**
 * F17 批次2：固化 tier_discount PromotionOrderAction 在 shop-api 下单链路的生效行为。
 * 档位播种仿 dev-server/china-data/10-member-tiers.ts（specialDiscountRate 为优惠千分比：50=95折），
 * 促销输入仿 dev-server/china-data/sources.ts:878-887（tier_eligible 条件 + tier_discount 动作，无券码自动适用）。
 * minLevel 取 1：额外覆盖「条件通过但档位 specialDiscountRate=0」路径——condition（tier_eligible）不判 0，
 * 由 action 对 rate<=0 返回 0 兜底，core 对 0 金额 adjustment 不落 discounts。
 */
describe('tier_discount promotion applies in shop-api checkout', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [MemberLevelPlugin.init({})],
        paymentOptions: {
            paymentMethodHandlers: [singleStageRefundablePaymentMethod],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    // 折算基准：Channel.pricesIncludeTax=true（beforeAll 设置），首变体含税价 129900 分
    const ORIGINAL_PRICE = 129900;
    // 金卡 specialDiscountRate=50（95折）→ discount = floor(129900 * 50 / 1000) = 6495
    const TIER_DISCOUNT = 6495;

    let variantId: string;
    let customerId: string;

    /* ------------------------- helpers ------------------------- */

    async function setChannelPricesIncludeTax(): Promise<void> {
        const channels = await adminClient.query(gql`
            query { channels { items { id } } }
        `) as any;
        const defaultChannelId = channels.channels.items[0].id;
        await adminClient.query(gql`
            mutation {
                updateChannel(input: { id: "${defaultChannelId}", pricesIncludeTax: true }) {
                    ... on Channel { id pricesIncludeTax }
                }
            }
        `);
    }

    async function getActiveOrder(): Promise<any> {
        const res = await shopClient.query(gql`
            query {
                activeOrder {
                    id subTotalWithTax totalWithTax
                    discounts { description amountWithTax }
                }
            }
        `) as any;
        return res.activeOrder;
    }

    async function adjustGrowth(amount: number): Promise<void> {
        await adminClient.query(gql`
            mutation {
                adjustMemberGrowth(customerId: "${customerId}", amount: ${amount}, source: "e2e") {
                    growthValue
                }
            }
        `);
    }

    async function freshOrder(): Promise<any> {
        const active = await getActiveOrder();
        if (active?.id) {
            await adminClient.query(gql`
                mutation { cancelOrder(input: { orderId: "${active.id}" }) {
                    ... on Order { id state }
                    ... on ErrorResult { errorCode message }
                } }
            `);
        }
        const res = await shopClient.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantId}", quantity: 1) {
                    ... on Order { id subTotalWithTax }
                    ... on ErrorResult { errorCode message }
                }
            }
        `) as any;
        return res.addItemToOrder;
    }

    /* ------------------------- beforeAll / afterAll ------------------------- */

    beforeAll(async () => {
        await server.init({
            initialData: {
                ...initialData,
                paymentMethods: [
                    { name: singleStageRefundablePaymentMethod.code, handler: { code: singleStageRefundablePaymentMethod.code, arguments: [] } },
                ],
            },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        await setChannelPricesIncludeTax();

        const products = await adminClient.query(gql`
            query { products(options: { take: 1 }) { items { id variants { id } } } }
        `) as any;
        variantId = products.products.items[0].variants[0].id;

        // 登录 shop 用户（hayden.zieme 为 customerCount:1 的种子客户）
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
        const me = await shopClient.query(gql`
            query { activeCustomer { id emailAddress } }
        `) as any;
        customerId = me.activeCustomer.id;

        // 1) 建档（saveTiers，仿 china-data 播种：普通/银卡无折扣，金卡 95折→优惠千分比 50）
        const tiers = await adminClient.query(gql`
            mutation {
                saveTiers(input: [
                    { tierLevel: 1, threshold: 0, name: "普通会员", pointsMultiplier: 1000, redeemDiscountRate: 1000, redeemCapRatio: 500, specialDiscountRate: 0 }
                    { tierLevel: 2, threshold: 1000, name: "银卡会员", pointsMultiplier: 1000, redeemDiscountRate: 1000, redeemCapRatio: 500, specialDiscountRate: 0 }
                    { tierLevel: 3, threshold: 5000, name: "金卡会员", pointsMultiplier: 1200, redeemDiscountRate: 1500, redeemCapRatio: 600, specialDiscountRate: 50 }
                ]) { tierLevel specialDiscountRate }
            }
        `) as any;
        expect(tiers.saveTiers.length).toBe(3);

        // 2) 建促销（仿 sources.ts:878-887 的 tier_discount 播种输入，enabled + 无券码自动适用）
        const promo = await adminClient.query(gql`
            mutation {
                createPromotion(input: {
                    enabled: true
                    translations: [{ languageCode: en, name: "会员等级专属95折", description: "member tier discount" }]
                    conditions: [{ code: "tier_eligible", arguments: [{ name: "minLevel", value: "1" }] }]
                    actions: [{ code: "tier_discount", arguments: [] }]
                }) { ... on Promotion { id name } }
            }
        `) as any;
        expect(promo.createPromotion.id).toBeDefined();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    /* ------------------------- 用例 ------------------------- */

    it('金卡顾客（growthValue=5000）：下单命中 tier_discount，5% 折让', async () => {
        await adjustGrowth(5000);
        const o = await freshOrder();
        // 促销无券码自动适用：subTotalWithTax 已含订单级折扣（129900 - 6495），
        // 行价不被促销改动（折扣以独立 discounts 行体现）
        expect(o.subTotalWithTax).toBe(ORIGINAL_PRICE - TIER_DISCOUNT);

        const active = await getActiveOrder();
        expect(active.discounts.length).toBe(1);
        expect(active.discounts[0].amountWithTax).toBe(-TIER_DISCOUNT);
        expect(active.discounts[0].description).toBe('会员等级专属95折');
        // totalWithTax = subTotal（已折后）- 0（AddingItems 阶段运费为 0）
        expect(active.totalWithTax).toBe(ORIGINAL_PRICE - TIER_DISCOUNT);
    });

    it('银卡顾客（growthValue=1000，档位 rate=0 且条件通过）：不产生折扣', async () => {
        await adjustGrowth(-4000); // 5000 → 1000
        const o = await freshOrder();
        expect(o.subTotalWithTax).toBe(ORIGINAL_PRICE);

        const active = await getActiveOrder();
        // tierLevel=2 ≥ minLevel=1 条件通过，但 rate=0 时 action 返回 0，
        // core 对 0 金额 adjustment 不落 discounts → 无折扣行、总额不动
        expect(active.discounts.length).toBe(0);
        expect(active.totalWithTax).toBe(active.subTotalWithTax);
    });

    it('普通顾客（growthValue=0）：无折扣', async () => {
        await adjustGrowth(-1000); // 1000 → 0
        const o = await freshOrder();
        expect(o.subTotalWithTax).toBe(ORIGINAL_PRICE);

        const active = await getActiveOrder();
        expect(active.discounts.length).toBe(0);
        expect(active.totalWithTax).toBe(active.subTotalWithTax);
    });
});
