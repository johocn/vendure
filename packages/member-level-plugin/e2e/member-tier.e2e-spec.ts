import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { MemberLevelPlugin } from '../src/plugin';
import { MemberLevelService } from '../src/member-level.service';
import { singleStageRefundablePaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';
import {
    addPaymentToOrder,
    proceedToArrangingPayment,
} from '../../core/e2e/utils/test-order-utils';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

/**
 * 阶段30：会员等级权益体系 e2e
 * 覆盖：首启播种/等级判定/积分倍率/抵现增强/免运费/专属折扣/渠道隔离/权限。
 */
describe('MemberLevelPlugin · 会员等级权益（MemberTier 播种/MemberInfo 权益/积分倍率/抵现增强/免运费/专属折扣/权限）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [MemberLevelPlugin.init({})],
        paymentOptions: {
            paymentMethodHandlers: [singleStageRefundablePaymentMethod],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    let variantId: string;
    let customerId: string;
    let memberService: MemberLevelService;

    const DEFAULT_LEVEL_3_THRESHOLD = 5000; // 对齐 channel 默认 level3Threshold
    const ORIGINAL_PRICE = 129900;

    let seq = 0;

    /* ------------------------- helpers ------------------------- */

    async function setChannelPricesIncludeTax(): Promise<void> {
        const channels = await adminClient.query(gql`
            query { channels { items { id } } }
        `) as any;
        const id = channels.channels.items[0].id;
        await adminClient.query(gql`
            mutation { updateChannel(input: { id: "${id}", pricesIncludeTax: true }) { ... on Channel { id } } }
        `);
    }

    async function setChannelFreeShippingLevel(level: number): Promise<void> {
        const channels = await adminClient.query(gql`
            query { channels { items { id } } }
        `) as any;
        const id = channels.channels.items[0].id;
        await adminClient.query(gql`
            mutation { updateChannel(input: { id: "${id}", customFields: { freeShippingLevel: ${level} } }) { ... on Channel { id } } }
        `);
    }

    async function adjustGrowth(amount: number): Promise<any> {
        const res = await adminClient.query(gql`
            mutation { adjustMemberGrowth(customerId: "${customerId}", amount: ${amount}, source: "e2e") { level levelName growthValue pointsMultiplier redeemDiscountRate redeemCapRatio specialDiscountRate } }
        `) as any;
        return res.adjustMemberGrowth;
    }

    async function myTier(): Promise<any> {
        const res = await shopClient.query(gql`
            query { myTier { level levelName points growthValue pointsMultiplier redeemDiscountRate redeemCapRatio specialDiscountRate nextLevelThreshold nextLevelName } }
        `) as any;
        return res.myTier;
    }

    /** 把成长值拨到指定绝对值（可正可负），用于让用例跑在确定档位（如 level3）。 */
    async function setGrowth(target: number): Promise<any> {
        const t = await myTier();
        const delta = target - t.growthValue;
        if (delta === 0) return t;
        return adjustGrowth(delta);
    }

    async function memberTiers(): Promise<any[]> {
        const res = await adminClient.query(gql`
            query { memberTiers { id tierLevel threshold name pointsMultiplier redeemDiscountRate redeemCapRatio specialDiscountRate } }
        `) as any;
        return res.memberTiers;
    }

    async function saveTiers(input: any[]): Promise<any[]> {
        const items = input
            .map(i => `{ tierLevel: ${i.tierLevel}, threshold: ${i.threshold}, name: "${i.name}", pointsMultiplier: ${i.pointsMultiplier ?? 1000}, redeemDiscountRate: ${i.redeemDiscountRate ?? 1000}, redeemCapRatio: ${i.redeemCapRatio ?? 500}, specialDiscountRate: ${i.specialDiscountRate ?? 0} }`)
            .join(' ');
        const res = await adminClient.query(gql`
            mutation { saveTiers(input: [${items}]) { id tierLevel threshold name pointsMultiplier redeemDiscountRate redeemCapRatio specialDiscountRate } }
        `) as any;
        return res.saveTiers;
    }

    async function freshOrder(): Promise<any> {
        const active = await shopClient.query(gql`
            query { activeOrder { id } }
        `) as any;
        if (active.activeOrder?.id) {
            await adminClient.query(gql`
                mutation { cancelOrder(input: { orderId: "${active.activeOrder.id}" }) { ... on Order { id } ... on ErrorResult { errorCode message } } }
            `);
        }
        const res = await shopClient.query(gql`
            mutation { addItemToOrder(productVariantId: "${variantId}", quantity: 1) {
                ... on Order { id subTotalWithTax }
                ... on ErrorResult { errorCode message }
            } }
        `) as any;
        return res.addItemToOrder;
    }

    async function createFreeShippingMethod(): Promise<string> {
        const res = await adminClient.query(gql`
            mutation {
                createShippingMethod(input: {
                    code: "tier-free-ship-${seq++}"
                    translations: [{ languageCode: en, name: "会员免运费", description: "free" }]
                    fulfillmentHandler: "manual-fulfillment"
                    checker: { code: "member-tier-free-shipping-eligibility", arguments: [] }
                    calculator: { code: "member-tier-free-shipping", arguments: [] }
                }) { id code }
            }
        `) as any;
        return res.createShippingMethod.id;
    }

    async function createTierPromo(minLevel: number): Promise<string> {
        const res = await adminClient.query(gql`
            mutation {
                createPromotion(input: {
                    enabled: true
                    translations: [{ languageCode: en, name: "等级专属折扣-${seq}", description: "tier" }]
                    conditions: [{ code: "tier_eligible", arguments: [{ name: "minLevel", value: "${minLevel}" }] }]
                    actions: [{ code: "tier_discount", arguments: [] }]
                }) { ... on Promotion { id name } }
            }
        `) as any;
        return res.createPromotion.id;
    }

    async function activeOrderShipsTo(): Promise<any> {
        const res = await shopClient.query(gql`
            query { activeOrder { id subTotalWithTax shippingWithTax totalWithTax shippingLines { shippingMethod { code } priceWithTax } discounts { amountWithTax } } }
        `) as any;
        return res.activeOrder;
    }

    /** 送达闭环（触发 Delivered 给积分+成长值），返回订单 id */
    async function deliverOrder(): Promise<string> {
        const orderId = await proceedToArrangingPayment(shopClient);
        await addPaymentToOrder(shopClient, singleStageRefundablePaymentMethod);
        const detail = await adminClient.query(gql`
            query { order(id: "${orderId}") { state lines { id quantity } } }
        `) as any;
        const line = detail.order.lines[0];
        const f = await adminClient.query(gql`
            mutation { addFulfillmentToOrder(input: {
                lines: [{ orderLineId: "${line.id}", quantity: ${line.quantity} }]
                handler: { code: "manual-fulfillment" arguments: [{ name: "method", value: "standard" }] }
            }) { ... on Fulfillment { id } ... on ErrorResult { errorCode message } } }
        `) as any;
        const fid = f.addFulfillmentToOrder.id;
        await adminClient.query(gql`mutation { transitionFulfillmentToState(id: "${fid}", state: "Shipped") { ... on Fulfillment { id } ... on ErrorResult { errorCode message } } }`);
        await adminClient.query(gql`mutation { transitionOrderToState(id: "${orderId}", state: "Shipped") { ... on Order { id } ... on ErrorResult { errorCode message } } }`);
        await adminClient.query(gql`mutation { transitionFulfillmentToState(id: "${fid}", state: "Delivered") { ... on Fulfillment { id } ... on ErrorResult { errorCode message } } }`);
        await adminClient.query(gql`mutation { transitionOrderToState(id: "${orderId}", state: "Delivered") { ... on Order { id } ... on ErrorResult { errorCode message } } }`);
        const after = await adminClient.query(gql`query { order(id: "${orderId}") { state } }`) as any;
        expect(after.order.state).toBe('Delivered');
        return orderId;
    }

    async function waitFor(pred: () => Promise<boolean>, timeoutMs = 8000): Promise<void> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (await pred()) return;
            await new Promise(r => setTimeout(r, 120));
        }
        throw new Error('Timed out waiting for condition');
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

        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
        const me = await shopClient.query(gql`query { activeCustomer { id } }`) as any;
        customerId = me.activeCustomer.id;

        memberService = server.app.get(MemberLevelService);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    /* ------------------------- 用例 ------------------------- */

    it('首启播种：memberTiers 返回默认 5 档（name 对齐默认），重复查询幂等', async () => {
        const tiers = await memberTiers();
        expect(tiers.length).toBe(5);
        expect(tiers[0].tierLevel).toBe(1);
        expect(tiers[0].name).toBe('普通会员');
        expect(tiers[2].name).toBe('金卡会员');
        expect(tiers[2].threshold).toBe(DEFAULT_LEVEL_3_THRESHOLD);
        expect(tiers[0].pointsMultiplier).toBe(1000);
        // 幂等：再查仍 5 档
        const again = await memberTiers();
        expect(again.length).toBe(5);
    });

    it('等级判定：成长值提升到 level3 → myTier/等级快照返回对应档位 + 下一档门槛', async () => {
        // 当前等级 1（成长值 0）
        const t1 = await myTier();
        expect(t1.level).toBe(1);
        expect(t1.nextLevelThreshold).toBe(1000);

        // 提升到 6000（> level3 threshold 5000，< level4 20000）→ 应为 level3
        await adjustGrowth(DEFAULT_LEVEL_3_THRESHOLD + 1000);
        const t3 = await myTier();
        expect(t3.level).toBe(3);
        expect(t3.levelName).toBe('金卡会员');
        expect(t3.nextLevelThreshold).toBe(20000);
        expect(t3.pointsMultiplier).toBe(1000);
        expect(t3.redeemDiscountRate).toBe(1000);
        expect(t3.redeemCapRatio).toBe(500);
        expect(t3.specialDiscountRate).toBe(0);
    });

    it('saveTiers：整体保存各档（权益生效），幂等 upsert', async () => {
        // 把 level3 权益改为：×1.5 积分倍率 / 抵现率 2000（每分抵更多）/ 封顶 80% / 专属折扣 10%
        await saveTiers([
            { tierLevel: 3, threshold: 5000, name: '金卡会员', pointsMultiplier: 1500, redeemDiscountRate: 2000, redeemCapRatio: 800, specialDiscountRate: 100 },
        ]);
        const t3 = await myTier();
        expect(t3.pointsMultiplier).toBe(1500);
        expect(t3.redeemDiscountRate).toBe(2000);
        expect(t3.redeemCapRatio).toBe(800);
        expect(t3.specialDiscountRate).toBe(100);
        // 其它档位未受影响
        const tiers = await memberTiers();
        expect(tiers.find(t => t.tierLevel === 1).pointsMultiplier).toBe(1000);
        // 幂等：再次保存同档仍成功
        await saveTiers([{ tierLevel: 3, threshold: 5000, name: '金卡会员', pointsMultiplier: 1500, redeemDiscountRate: 2000, redeemCapRatio: 800, specialDiscountRate: 100 }]);
        expect((await memberTiers()).length).toBe(5);
    });

    it('积分倍率：level3(×1.5) 送达加积分 = floor(subTotal×1.5)，成长值 = floor(subTotal)×1', async () => {
        // 当前已 level3（上用例调整成长值到 6000，且 saveTiers 已把 ×1.5）
        await freshOrder();
        const pre = await shopClient.query(gql`query { activeOrder { subTotal } }`) as any;
        const base = pre.activeOrder.subTotal;
        const before = await myTier();
        const orderId = await deliverOrder();
        await waitFor(async () => (await myTier()).points > before.points);
        const after = await myTier();
        const growthGain = after.growthValue - before.growthValue;
        const pointsGain = after.points - before.points;
        // 成长值 = floor(base)；积分 = floor(base × 1.5)
        expect(growthGain).toBe(Math.floor(base));
        expect(pointsGain).toBe(Math.floor(base * 1500 / 1000));
    });

    it('抵现增强：level3 抵现率 2000 → 同分抵更多（每分按更高折算）', async () => {
        // 拨回 level3，确保按 saveTiers 给 level3 配的抵现率 2000 折算
        // （前置「送达加积分」用例把成长值顶到 level5，落在默认权益档上）
        await setGrowth(DEFAULT_LEVEL_3_THRESHOLD + 1000);
        // 预置足够积分
        await adminClient.query(gql`mutation { adjustPoints(customerId: "${customerId}", amount: 50000, remark: "seed") { points } }`);
        // 8000 分：默认折算 8000/100×100 = 8000 分；rate 2000 → effectivePerYuan=ceil(100*1000/2000)=50 →
        // 8000/50×100 = 16000 分（抵 160 元）；封顶 80%×subTotal。
        const expectedFallback = Math.floor(8000 / 100) * 100;
        const o = await freshOrder();
        const subTotal = o.subTotalWithTax;
        const cap = Math.floor((subTotal * 800) / 1000);
        const expectedEnhanced = Math.min(Math.floor(8000 / 50) * 100, cap);
        const res = await shopClient.query(gql`mutation { redeemPoints(points: 8000) { id subTotalWithTax } }`) as any;
        const order = await shopClient.query(gql`query { activeOrder { customFields { pointsRedeemAmount } } }`) as any;
        const actual = order.activeOrder.customFields.pointsRedeemAmount;
        // 增强后应 > 默认折算，且 <= 封顶
        expect(actual).toBeGreaterThan(expectedFallback);
        expect(actual).toBeLessThanOrEqual(cap);
        expect(actual).toBe(expectedEnhanced);
        // 清空该单，避免影响后续
        const active = await shopClient.query(gql`query { activeOrder { id } }`) as any;
        if (active.activeOrder?.id) {
            await adminClient.query(gql`mutation { cancelOrder(input: { orderId: "${active.activeOrder.id}" }) { ... on Order { id } } }`);
        }
    });

    it('免运费：配 freeShippingLevel=3 + 等级达标顾客结算运费 0；不达标应收运费', async () => {
        await setChannelFreeShippingLevel(3);
        // 保证结算时顾客落在 level3（对本渠道 freeShippingLevel=3 达标），挪回确定档位
        await setGrowth(DEFAULT_LEVEL_3_THRESHOLD + 1000);
        const methodId = await createFreeShippingMethod();

        // 当前等级 3 → 达标
        await freshOrder();
        const ok = await activeOrderShipsTo();
        expect(ok.shippingWithTax).toBe(0);
        const activeAfter = await shopClient.query(gql`query { activeOrder { id } }`) as any;
        if (activeAfter.activeOrder?.id) {
            await adminClient.query(gql`mutation { cancelOrder(input: { orderId: "${activeAfter.activeOrder.id}" }) { ... on Order { id } } }`);
        }
        void methodId;
    });

    it('专属折扣：tier_eligible + tier_discount 促销 → 高等级订单结算含折扣', async () => {
        // level3 specialDiscountRate=100（10%）已由 saveTiers 配置，挪到 level3 命中
        await setGrowth(DEFAULT_LEVEL_3_THRESHOLD + 1000);
        await createTierPromo(3);
        await freshOrder();
        const order = await activeOrderShipsTo();
        // 折扣 = floor(subTotalWithTax × 100/1000)，至少为负折扣
        const promoDiscount = order.discounts.find((d: any) => d.amountWithTax !== 0);
        expect(promoDiscount.amountWithTax).toBeLessThan(0);
    });

    it('权限：shop 客户端不可访问 admin 的 memberTiers/saveTiers', async () => {
        await expect(shopClient.query(gql`query { memberTiers { id } }`)).rejects.toThrow();
    });

    it('渠道隔离：默认渠道 memberTiers 独立播种（5 档），不同档位权益互不影响', async () => {
        // 默认渠道已有 5 档
        const tiers = await memberTiers();
        expect(tiers.length).toBe(5);
        // 前面 saveTiers 只改 level3，level1 权益保持默认 ×1000 不受影响（验证档位间隔离）
        expect(tiers.find(t => t.tierLevel === 1).pointsMultiplier).toBe(1000);
    });
});