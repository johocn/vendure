import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { CouponPlugin } from '../src/plugin';
import { ShopPlugin } from '../../shop-plugin/src/plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('CouponPlugin · 到店买单（领券 → 试算 → 核销 → 流水）', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), { plugins: [CouponPlugin.init(), ShopPlugin.init()] }),
    );

    async function createTemplate(input: Record<string, unknown>): Promise<string> {
        const res = (await adminClient.query(gql`
            mutation {
                createCouponTemplate(input: {
                    name: "${input.name}"
                    type: ${input.type}
                    discountValue: ${input.discountValue}
                    minSpend: ${input.minSpend ?? 0}
                    usageScene: ${input.usageScene}
                    totalCount: 0
                    perUserLimit: 0
                    enabled: true
                }) { id usageScene }
            }
        `)) as any;
        expect(res.createCouponTemplate.usageScene).toBe(input.usageScene);
        return res.createCouponTemplate.id;
    }

    async function claim(templateId: string): Promise<any> {
        const res = (await shopClient.query(gql`
            mutation { claimCoupon(templateId: "${templateId}") { id code status } }
        `)) as any;
        return res.claimCoupon;
    }

    async function quote(code: string, originalAmount?: number | null): Promise<any> {
        const arg = originalAmount == null ? '' : `, originalAmount: ${originalAmount}`;
        const res = (await adminClient.query(gql`
            query { inStoreBillQuote(code: "${code}"${arg}) {
                ok reason couponCode couponName discountType discountValue minSpend
                originalAmount discountAmount finalAmount customerName customerPhone expiresAt
            } }
        `)) as any;
        return res.inStoreBillQuote;
    }

    async function redeem(code: string, originalAmount: number, remark?: string): Promise<any> {
        const res = (await adminClient.query(gql`
            mutation { inStoreBillRedeem(code: "${code}", originalAmount: ${originalAmount}${
                remark ? `, remark: "${remark}"` : ''
            }) {
                id couponCode couponName customerId customerName discountType discountValue
                originalAmount discountAmount finalAmount operatorId operatorName remark billedAt
            } }
        `)) as any;
        return res.inStoreBillRedeem;
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

    afterAll(async () => {
        await server.destroy();
    });

    it('全链路：IN_STORE 券 → 领券 → 试算 8 折 → 核销落流水 → 券置 USED → 流水可见', async () => {
        const tplId = await createTemplate({
            name: '到店 8 折',
            type: 'PERCENT',
            discountValue: 80,
            usageScene: 'IN_STORE',
        });
        const cc = await claim(tplId);
        expect(cc.status).toBe('UNUSED');

        // 试算：仅券信息（不传原价）
        const info = await quote(cc.code);
        expect(info.ok).toBe(true);
        expect(info.finalAmount).toBeNull();
        expect(info.discountValue).toBe(80);

        // 试算：原价 20000 分 → 优惠 4000 / 实付 16000
        const q = await quote(cc.code, 20000);
        expect(q).toMatchObject({ ok: true, originalAmount: 20000, discountAmount: 4000, finalAmount: 16000 });

        // 核销
        const bill = await redeem(cc.code, 20000, 'e2e');
        expect(bill).toMatchObject({
            couponCode: cc.code,
            couponName: '到店 8 折',
            discountType: 'PERCENT',
            discountValue: 80,
            originalAmount: 20000,
            discountAmount: 4000,
            finalAmount: 16000,
            remark: 'e2e',
        });
        expect(bill.billedAt).toBeTruthy();

        // 券已置 USED
        const used = (await shopClient.query(gql`
            query { myCoupons(status: USED) { code status } }
        `)) as any;
        expect(used.myCoupons.some((c: any) => c.code === cc.code)).toBe(true);

        // 流水汇总 + 列表可见
        const sum = (await adminClient.query(gql`
            query { inStoreBillSummary { count originalTotal discountTotal finalTotal } }
        `)) as any;
        expect(sum.inStoreBillSummary).toMatchObject({
            count: 1, originalTotal: 20000, discountTotal: 4000, finalTotal: 16000,
        });
        const list = (await adminClient.query(gql`
            query { inStoreBills(options: { take: 10 }) { totalItems items { id couponCode finalAmount } } }
        `)) as any;
        expect(list.inStoreBills.totalItems).toBe(1);
        expect(list.inStoreBills.items[0].couponCode).toBe(cc.code);
    });

    it('重复核销同一券码 → 报错且不新增流水', async () => {
        const tplId = await createTemplate({
            name: '到店 9 折',
            type: 'PERCENT',
            discountValue: 90,
            usageScene: 'IN_STORE',
        });
        const cc = await claim(tplId);
        await redeem(cc.code, 10000);
        await expect(redeem(cc.code, 10000)).rejects.toThrow(/已使用|不可用/);

        const sum = (await adminClient.query(gql`
            query { inStoreBillSummary { count } }
        `)) as any;
        expect(sum.inStoreBillSummary.count).toBe(2);
    });

    it('ONLINE 场景券不可到店核销 → ok=false SCENE_MISMATCH', async () => {
        const tplId = await createTemplate({
            name: '线上满减',
            type: 'FIXED',
            discountValue: 2000,
            usageScene: 'ONLINE',
        });
        const cc = await claim(tplId);
        const q = await quote(cc.code, 10000);
        expect(q).toMatchObject({ ok: false, reason: 'SCENE_MISMATCH' });
        await expect(redeem(cc.code, 10000)).rejects.toThrow(/不支持到店买单/);
    });

    it('未达门槛 → quote ok=false MIN_SPEND_NOT_MET；核销被拒', async () => {
        const tplId = await createTemplate({
            name: '到店满100减20',
            type: 'FIXED',
            discountValue: 2000,
            minSpend: 10000,
            usageScene: 'IN_STORE',
        });
        const cc = await claim(tplId);
        const q = await quote(cc.code, 5000);
        expect(q).toMatchObject({ ok: false, reason: 'MIN_SPEND_NOT_MET' });
        await expect(redeem(cc.code, 5000)).rejects.toThrow(/门槛/);
    });

    it('shop-api 暴露 CouponTemplate.usageScene（C 端据此展示券码入口）', async () => {
        const res = (await shopClient.query(gql`
            query { couponCentre { id name usageScene discountValue } }
        `)) as any;
        expect(res.couponCentre.every((c: any) => typeof c.usageScene === 'string')).toBe(true);
    });
});
