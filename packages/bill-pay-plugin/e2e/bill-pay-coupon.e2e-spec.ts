import { ChannelService, mergeConfig, RequestContext } from '@vendure/core';
import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// 与 BillPayService 内部引用保持同一模块图（服务层 import 的是包入口，即 lib 产物），
// 否则会出现两套 CouponTemplate/CustomerCoupon 实体类，TypeORM 元数据不一致。
import { CouponPlugin } from '@vendure/coupon-plugin';
import { ShopPlugin } from '@vendure/shop-plugin';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { BillPayService } from '../src/bill-pay.service';
import { BillPayPlugin } from '../src/plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

/**
 * 代买单 × 到店买单券（IN_STORE）抵扣链路 e2e。
 *
 * 覆盖券在委托单上的完整生命周期：报价抵扣 → 预占 → 支付核销 → 取消释放，
 * 以及各类拒绝路径（未启用 / 非到店场景 / 门槛不足 / 人工报价金额）。
 * 金额单位统一为「分」。每个用例使用独立券模板与券码，避免跨用例状态串扰。
 */
describe('BillPay × Coupon · 到店买单券抵扣代买单委托单', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [CouponPlugin.init(), ShopPlugin.init(), BillPayPlugin.init()],
            // 商品 CSV 引用的图片在 core 的 e2e fixtures 下；不覆盖会让导入报「图片不存在」噪音日志。
            importExportOptions: {
                importAssetsDir: path.join(__dirname, '../../core/e2e/fixtures/assets'),
            },
        }),
    );

    /**
     * 已知基线配置。每个用例前重置，避免「couponEnabled=false / 自定义限额」从前一个用例泄漏。
     * dailyLimitAmount 取 500000，保证 10 个用例累计金额不会误触单日限额。
     */
    const BASE_CONFIG = {
        autoQuote: true,
        quoteExpireMinutes: 30,
        couponEnabled: true,
        tolerancePercent: 10,
        minAmount: 2000,
        maxAmount: 200000,
        dailyLimitAmount: 500000,
        memberDiscount: null,
        thresholds: [],
    };

    async function setConfig(overrides: Partial<typeof BASE_CONFIG> = {}): Promise<void> {
        await adminClient.query(
            gql`
                mutation SaveConfig($config: JSON!) {
                    saveBillPayChannelConfig(config: $config) {
                        autoQuote
                        couponEnabled
                        minAmount
                        maxAmount
                    }
                }
            `,
            { config: { ...BASE_CONFIG, ...overrides } },
        );
    }

    async function createTemplate(input: {
        name?: string;
        type: 'FIXED' | 'PERCENT' | 'FULL';
        discountValue: number;
        minSpend?: number;
        usageScene: 'ONLINE' | 'IN_STORE' | 'ALL';
    }): Promise<string> {
        const res = (await adminClient.query(
            gql`
                mutation CreateTemplate($input: CreateCouponTemplateInput!) {
                    createCouponTemplate(input: $input) {
                        id
                        enabled
                        usageScene
                    }
                }
            `,
            {
                input: {
                    name: input.name ?? `e2e-${input.type}-${input.discountValue}`,
                    type: input.type,
                    discountValue: input.discountValue,
                    minSpend: input.minSpend ?? 0,
                    usageScene: input.usageScene,
                    totalCount: 0,
                    perUserLimit: 0,
                    enabled: true,
                },
            },
        )) as any;
        expect(res.createCouponTemplate.enabled).toBe(true);
        expect(res.createCouponTemplate.usageScene).toBe(input.usageScene);
        return res.createCouponTemplate.id;
    }

    async function claim(templateId: string): Promise<any> {
        const res = (await shopClient.query(
            gql`
                mutation Claim($templateId: ID!) {
                    claimCoupon(templateId: $templateId) {
                        id
                        code
                        status
                        reservedOrderId
                    }
                }
            `,
            { templateId },
        )) as any;
        return res.claimCoupon;
    }

    async function myCoupons(status?: string): Promise<any[]> {
        const res = (await shopClient.query(
            gql`
                query MyCoupons($status: CouponStatus) {
                    myCoupons(status: $status) {
                        code
                        status
                        reservedOrderId
                        usedOrderId
                    }
                }
            `,
            { status: status ?? null },
        )) as any;
        return res.myCoupons;
    }

    async function createOrder(expectedAmount: number, couponCode?: string): Promise<any> {
        const input: Record<string, unknown> = { merchantName: 'e2e-商家', expectedAmount };
        if (couponCode !== undefined) {
            input.couponCode = couponCode;
        }
        const res = (await shopClient.query(
            gql`
                mutation CreateOrder($input: CreateBillPayOrderInput!) {
                    createBillPayOrder(input: $input) {
                        id
                        code
                        status
                        expectedAmount
                        quoteAmount
                        couponCode
                        couponDiscount
                        discountDetail
                    }
                }
            `,
            { input },
        )) as any;
        return res.createBillPayOrder;
    }

    async function cancelOrder(id: string): Promise<any> {
        const res = (await shopClient.query(
            gql`
                mutation Cancel($id: ID!) {
                    cancelBillPayOrder(id: $id) {
                        id
                        code
                        status
                    }
                }
            `,
            { id },
        )) as any;
        return res.cancelBillPayOrder;
    }

    async function getOrder(id: string): Promise<any> {
        const res = (await shopClient.query(
            gql`
                query Order($id: ID!) {
                    billPayOrder(id: $id) {
                        id
                        code
                        status
                        quoteAmount
                        couponCode
                        couponDiscount
                    }
                }
            `,
            { id },
        )) as any;
        return res.billPayOrder;
    }

    async function quoteInStore(code: string, originalAmount: number): Promise<any> {
        const res = (await adminClient.query(
            gql`
                query Quote($code: String!, $originalAmount: Int) {
                    inStoreBillQuote(code: $code, originalAmount: $originalAmount) {
                        ok
                        reason
                        couponCode
                        finalAmount
                    }
                }
            `,
            { code, originalAmount },
        )) as any;
        return res.inStoreBillQuote;
    }

    async function redeemInStore(code: string, originalAmount: number): Promise<any> {
        const res = (await adminClient.query(
            gql`
                mutation Redeem($code: String!, $originalAmount: Int!) {
                    inStoreBillRedeem(code: $code, originalAmount: $originalAmount) {
                        id
                        couponCode
                        originalAmount
                        discountAmount
                        finalAmount
                    }
                }
            `,
            { code, originalAmount },
        )) as any;
        return res.inStoreBillRedeem;
    }

    /**
     * e2e harness 使用 TestingEntityIdStrategy，GraphQL 的 ID 标量会加 `T_` 前缀（含非实体 id 的字符串字段），
     * 而 Service 内部落库/回调比对用的是原始码，断言前需还原。
     */
    function decodeId(value: any): any {
        return typeof value === 'string' ? value.replace(/^T_/, '') : value;
    }

    /** discountDetail 是 JSON 标量，真实 DB 下按数组返回；兼容被序列化成字符串的实现差异 */
    function discountDetailOf(order: any): any[] {
        const raw = order.discountDetail;
        if (raw == null) return [];
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    }

    /**
     * 模拟微信支付成功回调：测试环境不便构造真实微信通知，
     * 直接调用回调结算入口 `settleBillPayOrderByOutTradeNo`（与 /wechatpay/notify 同一条路径）。
     */
    async function simulatePaidCallback(outTradeNo: string): Promise<void> {
        const service = server.app.get(BillPayService);
        const channel = await server.app.get(ChannelService).getDefaultChannel();
        const ctx = new RequestContext({
            apiType: 'shop',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
        await service.settleBillPayOrderByOutTradeNo(ctx, outTradeNo);
    }

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 2,
        });
        await adminClient.asSuperAdmin();
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
    }, TEST_SETUP_TIMEOUT_MS);

    // 渠道配置是全局单行记录：每个用例重置回基线，保证拒绝/通过断言只由本用例的输入决定。
    beforeEach(async () => {
        await setConfig();
    });

    afterAll(async () => {
        await server.destroy();
    });

    it('用券下单：IN_STORE 8 折券按原价抵扣，报价应付 8000、券抵扣 2000 且明细含 coupon', async () => {
        const tplId = await createTemplate({
            name: 'e2e-到店8折',
            type: 'PERCENT',
            discountValue: 80,
            usageScene: 'IN_STORE',
        });
        const coupon = await claim(tplId);
        expect(coupon.status).toBe('UNUSED');

        const order = await createOrder(10000, coupon.code);

        // 券按「商家账单原价」计算折扣（与到店核销同口径），再叠加在自动报价应付之上：
        // 原价 10000、8 折 → 券抵 2000，最终应付 8000；落 coupon 明细便于对账。
        expect(order).toMatchObject({
            status: 'QUOTED',
            expectedAmount: 10000,
            quoteAmount: 8000,
            couponCode: coupon.code,
            couponDiscount: 2000,
        });
        const detail = discountDetailOf(order);
        expect(detail.some((d: any) => d.rule === 'coupon' && d.amount === 2000)).toBe(true);
    });

    it('满载截断：FULL 券面额高于应付时，券抵扣不超过应付（应付 0、抵扣 10000）', async () => {
        const tplId = await createTemplate({
            name: 'e2e-无条件直减200',
            type: 'FULL',
            discountValue: 20000,
            usageScene: 'IN_STORE',
        });
        const coupon = await claim(tplId);

        const order = await createOrder(10000, coupon.code);

        // 券面额 20000 > 应付 10000：应付截断为 0，明细金额同步截断为 10000，
        // 保证「明细合计 = 原价 - 应付」仍成立，避免对账出现负数抵扣。
        expect(order).toMatchObject({
            status: 'QUOTED',
            expectedAmount: 10000,
            quoteAmount: 0,
            couponDiscount: 10000,
        });
        const detail = discountDetailOf(order);
        expect(detail.find((d: any) => d.rule === 'coupon')?.amount).toBe(10000);
    });

    it('券被预占后不可重复使用：同码第二单报错、第一单仍为 QUOTED', async () => {
        const tplId = await createTemplate({
            name: 'e2e-到店9折',
            type: 'PERCENT',
            discountValue: 90,
            usageScene: 'IN_STORE',
        });
        const coupon = await claim(tplId);
        const first = await createOrder(10000, coupon.code);
        expect(first.status).toBe('QUOTED');

        // 同一张券已被下单预占（reservedOrderId），第二单在「原子预占」处被截断并回滚。
        await expect(createOrder(10000, coupon.code)).rejects.toThrow(/Coupon is already in use/);

        // 第一单不受失败请求影响，仍是已报价可支付状态。
        const fresh = await getOrder(first.id);
        expect(fresh.status).toBe('QUOTED');

        // 券状态仍是 UNUSED，但 reservedOrderId 指向第一单 —— 这正是「预占」而非「已用」的语义。
        const unused = await myCoupons('UNUSED');
        expect(decodeId(unused.find((c: any) => c.code === coupon.code)?.reservedOrderId)).toBe(
            first.code,
        );
    });

    it('预占中的券不能线下核销：inStoreBillQuote 返回 COUPON_NOT_UNUSED，redeem 抛错', async () => {
        const tplId = await createTemplate({
            name: 'e2e-预占不可核销',
            type: 'PERCENT',
            discountValue: 80,
            usageScene: 'IN_STORE',
        });
        const coupon = await claim(tplId);
        await createOrder(10000, coupon.code);

        // 券虽仍为 UNUSED，但已被线上委托单锁定；线下再核销会与线上单双花，
        // 故复用「已使用或不可用」原因码拒绝。
        const quote = await quoteInStore(coupon.code, 10000);
        expect(quote).toMatchObject({ ok: false, reason: 'COUPON_NOT_UNUSED' });

        await expect(redeemInStore(coupon.code, 10000)).rejects.toThrow(/已使用|不可用/);
    });

    it('支付成功核销券：回调结算后订单 PAID、券置 USED，之后线下核销仍不可用', async () => {
        const tplId = await createTemplate({
            name: 'e2e-支付核销券',
            type: 'PERCENT',
            discountValue: 80,
            usageScene: 'IN_STORE',
        });
        const coupon = await claim(tplId);
        const order = await createOrder(10000, coupon.code);
        expect(order.status).toBe('QUOTED');

        // 回调结算与置 PAID 同事务核销券：订单转 PAID，券落到 USED 并记录 usedOrderId。
        await simulatePaidCallback(order.code);
        const paid = await getOrder(order.id);
        expect(paid.status).toBe('PAID');

        const used = await myCoupons('USED');
        const usedCoupon = used.find((c: any) => c.code === coupon.code);
        expect(usedCoupon?.status).toBe('USED');
        expect(decodeId(usedCoupon?.usedOrderId)).toBe(order.code);

        // 券已核销：线下核销入口同样必须拒绝，防止二次消费。
        const quote = await quoteInStore(coupon.code, 10000);
        expect(quote).toMatchObject({ ok: false, reason: 'COUPON_NOT_UNUSED' });
    });

    it('取消订单释放券：订单 CANCELLED、券回 UNUSED，同码可再次下单成功', async () => {
        const tplId = await createTemplate({
            name: 'e2e-取消释放券',
            type: 'FIXED',
            discountValue: 2000,
            usageScene: 'IN_STORE',
        });
        const coupon = await claim(tplId);
        const first = await createOrder(10000, coupon.code);

        const cancelled = await cancelOrder(first.id);
        expect(cancelled.status).toBe('CANCELLED');

        // 释放的是「本单预占」：券回 UNUSED 且 reservedOrderId 清空。
        const unused = await myCoupons('UNUSED');
        const released = unused.find((c: any) => c.code === coupon.code);
        expect(released?.status).toBe('UNUSED');
        expect(released?.reservedOrderId ?? null).toBeNull();

        // 能再次下单成功才证明释放真正生效（否则预占位仍会挡住同码下单）。
        const second = await createOrder(10000, coupon.code);
        expect(second.status).toBe('QUOTED');
        expect(second.couponCode).toBe(coupon.code);
    });

    it('未启用用券被拒：couponEnabled=false 时带券下单报错', async () => {
        await setConfig({ couponEnabled: false });
        const tplId = await createTemplate({
            name: 'e2e-未启用用券',
            type: 'FIXED',
            discountValue: 2000,
            usageScene: 'IN_STORE',
        });
        const coupon = await claim(tplId);

        await expect(createOrder(10000, coupon.code)).rejects.toThrow(
            /Coupon not enabled for bill pay/,
        );
    });

    it('非到店券被拒：ONLINE 场景券不能用于代买单', async () => {
        const tplId = await createTemplate({
            name: 'e2e-线上券',
            type: 'FIXED',
            discountValue: 2000,
            usageScene: 'ONLINE',
        });
        const coupon = await claim(tplId);

        // 场景不符与「非本人/已用」共用同一文案，避免券码枚举泄露信息。
        await expect(createOrder(10000, coupon.code)).rejects.toThrow(
            /Coupon is not applicable to bill pay/,
        );
    });

    it('门槛不足被拒：券 minSpend=20000、订单 10000 时按 IN_STORE 文案拒绝', async () => {
        const tplId = await createTemplate({
            name: 'e2e-满200减20',
            type: 'FIXED',
            discountValue: 2000,
            minSpend: 20000,
            usageScene: 'IN_STORE',
        });
        const coupon = await claim(tplId);

        // 门槛按商家账单原价判定（复用 computeInStoreBill），不足时抛出与到店核销一致的中文文案。
        await expect(createOrder(10000, coupon.code)).rejects.toThrow(/未达到该券使用门槛/);
    });

    it('人工报价金额不支持用券：超 maxAmount 的订单带券被拒', async () => {
        const tplId = await createTemplate({
            name: 'e2e-人工报价券',
            type: 'FULL',
            discountValue: 500,
            usageScene: 'IN_STORE',
        });
        const coupon = await claim(tplId);

        // 300000 > maxAmount(200000) 会转人工报价，人工改价会重写金额与明细、无法保留券抵扣，
        // 因此券路径直接拒绝，避免落成「有券码无抵扣」的脏单把券锁死。
        await expect(createOrder(300000, coupon.code)).rejects.toThrow(
            /Coupon not supported for manual quote amount/,
        );
    });
});
