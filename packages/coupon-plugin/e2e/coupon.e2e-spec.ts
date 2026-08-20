import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { LanguageCode, mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { CouponPlugin } from '../src/plugin';
import { testSuccessfulPaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';
import {
    addPaymentToOrder,
    proceedToArrangingPayment,
} from '../../core/e2e/utils/test-order-utils';
import { assertThrowsWithMessage } from '../../core/e2e/utils/assert-throws-with-message';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('CouponPlugin · 营销促销闭环（优惠券体系）', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [CouponPlugin.init()],
            paymentOptions: {
                paymentMethodHandlers: [testSuccessfulPaymentMethod],
            },
        }),
    );

    let variantId: string;
    let myCustomerId: string;
    let otherCustomerId: string;

    async function createTemplate(input: Record<string, unknown>): Promise<string> {
        const res = await adminClient.query(gql`
            mutation {
                createCouponTemplate(input: {
                    name: "${input.name}"
                    type: ${input.type}
                    discountValue: ${input.discountValue}
                    minSpend: ${input.minSpend ?? 0}
                    ${input.endsAt ? `endsAt: "${input.endsAt}"` : ''}
                    totalCount: ${input.totalCount ?? 0}
                    perUserLimit: ${input.perUserLimit ?? 0}
                    enabled: ${input.enabled ?? true}
                }) { id }
            }
        `) as any;
        return res.createCouponTemplate.id;
    }

    async function claim(templateId: string): Promise<any> {
        const res = await shopClient.query(gql`
            mutation { claimCoupon(templateId: "${templateId}") { id code status issuedBy } }
        `);
        return res.claimCoupon;
    }

    async function addToCart(qty = 1): Promise<any> {
        const res = await shopClient.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantId}", quantity: ${qty}) {
                    ... on Order { id subTotalWithTax }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);
        return res.addItemToOrder;
    }

    async function apply(code: string): Promise<any> {
        const res = await shopClient.query(gql`
            mutation {
                applyCouponToOrder(code: "${code}") {
                    id subTotalWithTax totalWithTax discounts { amount amountWithTax adjustmentSource }
                }
            }
        `);
        return res.applyCouponToOrder;
    }

    /** 清理遗留活动订单，保证用例间隔离（订单隔离层级：每个用自己干净的订单） */
    async function resetActiveOrder(): Promise<void> {
        const active = await shopClient.query(gql`
            query { activeOrder { id } }
        `);
        if (active.activeOrder?.id) {
            await adminClient.query(gql`
                mutation { cancelOrder(input: { orderId: "${active.activeOrder.id}" }) { ... on Order { id state } ... on ErrorResult { errorCode message } } }
            `);
        }
    }

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
            customerCount: 2,
        });
        await adminClient.asSuperAdmin();

        const products = await adminClient.query(gql`
            query { products(options: { take: 1 }) { items { id variants { id } } } }
        `);
        variantId = (products.products.items[0].variants[0] as any).id;

        // 让结算基准统一为「含税小计」，使折扣额可精确推算
        const channels = await adminClient.query(gql`
            query { channels { items { id } } }
        `);
        const defaultChannelId = channels.channels.items[0].id;
        await adminClient.query(gql`
            mutation { updateChannel(input: { id: "${defaultChannelId}", pricesIncludeTax: true }) { ... on Channel { id pricesIncludeTax } } }
        `);

        // 登录 C端用户，获取其 Customer.id 与另一个客户的 id（用于非本人券鉴权校验）
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
        const me = await shopClient.query(gql`
            query { activeCustomer { id } }
        `);
        myCustomerId = (me.activeCustomer as any).id;
        const custs = await adminClient.query(gql`
            query { customers(options: { take: 5 }) { items { id } } }
        `);
        otherCustomerId = custs.customers.items.find(
            (c: any) => c.id !== myCustomerId,
        ).id;

        // 建一张绑定 coupon_applied + coupon_discount 的促销，所有券共用同一张促销
        await adminClient.query(gql`
            mutation {
                createPromotion(input: {
                    enabled: true
                    translations: [
                        { languageCode: en, name: "Coupon discount", description: "coupon applied" }
                    ]
                    conditions: [{ code: "coupon_applied", arguments: [] }]
                    actions: [{ code: "coupon_discount", arguments: [] }]
                }) { ... on Promotion { id name } }
            }
        `);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('插件可加载', () => {
        expect(server.app).toBeDefined();
    });

    it('满减券全链路：建→领→选券→订单减20→支付→USED+usedOrderId 落单', async () => {
        const tplId = await createTemplate({
            name: '满100减20',
            type: 'FIXED',
            discountValue: 2000,
            minSpend: 10000,
        });

        const cc = await claim(tplId);
        expect(cc.status).toBe('UNUSED');

        await resetActiveOrder();
        const order = await addToCart(1);
        const before = order.subTotalWithTax;
        const applied = await apply(cc.code);
        // 固定减 2000（金额单位：分）
        expect(applied.subTotalWithTax).toBe(before - 2000);
        const couponDiscount = applied.discounts.find((d: any) => d.amountWithTax === -2000);
        expect(couponDiscount).toBeDefined();
        expect(couponDiscount.amountWithTax).toBe(-2000);

        // 支付前用户券仍 UNUSED
        const unusedBefore = await shopClient.query(gql`
            query { myCoupons(status: UNUSED) { code status } }
        `);
        expect(unusedBefore.myCoupons.some((c: any) => c.code === cc.code)).toBe(true);

        // 支付成功 → 订单置 Placed → 核销为 USED 且落 usedOrderId
        await proceedToArrangingPayment(shopClient);
        const paid = await addPaymentToOrder(shopClient, testSuccessfulPaymentMethod);
        expect(paid.id).toBeDefined();

        const used = await shopClient.query(gql`
            query { myCoupons(status: USED) { code status usedOrderId } }
        `);
        const usedCc = used.myCoupons.find((c: any) => c.code === cc.code);
        expect(usedCc.status).toBe('USED');
        expect(String(usedCc.usedOrderId)).toBe(String(paid.id));
    });

    it('折扣券金额核算（8.5折 15% off）', async () => {
        const tplId = await createTemplate({
            name: '满50打8.5折',
            type: 'PERCENT',
            discountValue: 85,
            minSpend: 5000,
        });
        const cc = await claim(tplId);

        await resetActiveOrder();
        const order = await addToCart(1);
        const before = order.subTotalWithTax;
        const expected = Math.round(before * ((100 - 85) / 100));
        const applied = await apply(cc.code);
        expect(applied.subTotalWithTax).toBe(before - expected);
    });

    it('防超发（totalCount 边界 第N+1 次不可领）+ perUserLimit 超领失败', async () => {
        const limitedTpl = await createTemplate({
            name: '限量2张',
            type: 'FULL',
            discountValue: 500,
            totalCount: 2,
            perUserLimit: 0,
        });
        // 同一用户领 2 张后，第 3 张触发原子扣减失败 → 售罄
        await claim(limitedTpl);
        await claim(limitedTpl);
        await assertThrowsWithMessage(async () => claim(limitedTpl), 'sold out');

        const perUserTpl = await createTemplate({
            name: '限领1张',
            type: 'FULL',
            discountValue: 500,
            totalCount: 0,
            perUserLimit: 1,
        });
        await claim(perUserTpl);
        await assertThrowsWithMessage(async () => claim(perUserTpl), 'Per-user coupon limit reached');
    });

    it('过期不可领 / 已过期不可用', async () => {
        const pastEnd = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const tplId = await createTemplate({
            name: '已过期券',
            type: 'FIXED',
            discountValue: 1000,
            endsAt: pastEnd,
        });
        // 领券中心不展示已过期模板
        const centre = await shopClient.query(gql`
            query { couponCentre { id } }
        `);
        expect(centre.couponCentre.some((t: any) => String(t.id) === String(tplId))).toBe(false);
        await assertThrowsWithMessage(async () => claim(tplId), 'Coupon has expired');

        // 定向发放一张过期券给当前用户，结算选券时被拦截（先过归属校验，再过有效期）
        const grant = await adminClient.query(gql`
            mutation { grantCoupon(templateId: "${tplId}", customerIds: ["${myCustomerId}"]) }
        `) as any;
        await resetActiveOrder();
        await addToCart(1);
        await assertThrowsWithMessage(async () => shopClient.query(gql`
            mutation { applyCouponToOrder(code: "${grant.grantCoupon[0]}") { id } }
        `), 'Coupon has expired');
    });

    it('取消订单回退 RETURNED 可复用；已核销支付态不自动回退', async () => {
        const tplId = await createTemplate({
            name: '可复用券',
            type: 'FULL',
            discountValue: 500,
        });
        const cc = await claim(tplId);

        await resetActiveOrder();
        await addToCart(1);
        await apply(cc.code);
        await proceedToArrangingPayment(shopClient);
        const paid = await addPaymentToOrder(shopClient, testSuccessfulPaymentMethod);
        const orderId = paid.id;
        // 支付成功（非取消态）时不回退，仍是 USED
        const afterPaid = await shopClient.query(gql`
            query { myCoupons(status: USED) { code status usedOrderId } }
        `);
        expect(afterPaid.myCoupons.find((c: any) => c.code === cc.code).status).toBe('USED');

        // 取消订单 → 回退为 RETURNED，usedOrderId 清空
        await adminClient.query(gql`
            mutation { cancelOrder(input: { orderId: "${orderId}" }) { ... on Order { id state } ... on ErrorResult { errorCode message } } }
        `);
        const returned = await shopClient.query(gql`
            query { myCoupons(status: RETURNED) { code status usedOrderId } }
        `);
        const r = returned.myCoupons.find((c: any) => c.code === cc.code);
        expect(r.status).toBe('RETURNED');
        expect(r.usedOrderId).toBeNull();

        // 回退后的券可再次使用
        await addToCart(1);
        const re = await apply(cc.code);
        expect(re.totalWithTax).toBeDefined();
    });

    it('未达门槛 / 非本人券 / 已用券不可选', async () => {
        await resetActiveOrder();
        // 1) 未达门槛
        const thresholdTpl = await createTemplate({
            name: '满2000减50',
            type: 'FIXED',
            discountValue: 5000,
            minSpend: 200000,
        });
        const ccThresh = await claim(thresholdTpl);
        await addToCart(1);
        await assertThrowsWithMessage(async () => apply(ccThresh.code), 'below minimum spend');

        // 2) 非本人券：将一张券定向发给其他用户，本用户不可选
        const grantTpl = await createTemplate({
            name: '他人券',
            type: 'FULL',
            discountValue: 500,
        });
        const grant = await adminClient.query(gql`
            mutation { grantCoupon(templateId: "${grantTpl}", customerIds: ["${otherCustomerId}"]) }
        `) as any;
        await assertThrowsWithMessage(
            async () => shopClient.query(gql`
                mutation { applyCouponToOrder(code: "${grant.grantCoupon[0]}") { id } }
            `),
            'does not belong to you',
        );

        // 3) 已用券不可选：先把券用在订单上并支付核销为 USED，再选同券报「不可用」
        const tplId = await createTemplate({
            name: '已用券',
            type: 'FULL',
            discountValue: 500,
        });
        const ccUsed = await claim(tplId);
        await resetActiveOrder();
        await addToCart(1);
        await apply(ccUsed.code);
        await proceedToArrangingPayment(shopClient);
        await addPaymentToOrder(shopClient, testSuccessfulPaymentMethod);
        await resetActiveOrder();
        await addToCart(1);
        await assertThrowsWithMessage(async () => apply(ccUsed.code), 'not in a usable state');
    }, TEST_SETUP_TIMEOUT_MS);
});