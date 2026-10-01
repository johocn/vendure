import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Administrator, Customer } from '@vendure/core';

import { InStoreBill } from './in-store-bill.entity';
import { InStoreBillService } from './in-store-bill.service';
import { IN_STORE_REASON } from './in-store-bill';
import { CustomerCoupon } from './customer-coupon.entity';

/** 构造一张可用到店买单券模板 */
function tplStub(over: Record<string, any> = {}): any {
    return {
        id: 7,
        type: 'PERCENT',
        discountValue: 80,
        minSpend: 0,
        enabled: true,
        shopId: null as number | null,
        name: '到店 8 折',
        channels: [{ id: 3 }],
        ...over,
    };
}

function ccStub(over: Record<string, any> = {}): any {
    return {
        id: 11,
        code: 'C-ABCD-EFGH',
        customerId: 5,
        templateId: 7,
        status: 'UNUSED',
        expiredAt: null as Date | null,
        template: tplStub(),
        ...over,
    };
}

describe('InStoreBillService.quote', () => {
    const ctx: any = { channelId: 3, activeUserId: 99, languageCode: 'zh_Hans' };

    let ccRepo: any;
    let billRepo: any;
    let customerRepo: any;
    let adminRepo: any;
    let connection: any;
    let couponService: any;
    let service: InStoreBillService;

    beforeEach(() => {
        ccRepo = { findOne: vi.fn(), createQueryBuilder: vi.fn() };
        billRepo = { save: vi.fn(async (b: any) => ({ id: 1, ...b })), createQueryBuilder: vi.fn() };
        customerRepo = { findOne: vi.fn(async () => ({ firstName: '三', lastName: '张', phoneNumber: '13800000000', emailAddress: 'a@b.c' })) };
        adminRepo = { findOne: vi.fn(async () => ({ firstName: '掌', lastName: '柜', emailAddress: 'op@shop.c' })) };
        connection = {
            getRepository: vi.fn((_c: any, entity: any) => {
                if (entity === CustomerCoupon) return ccRepo;
                if (entity === InStoreBill) return billRepo;
                if (entity === Customer) return customerRepo;
                if (entity === Administrator) return adminRepo;
                throw new Error(`unknown entity: ${entity?.name}`);
            }),
        };
        couponService = {
            templateBelongsToChannel: vi.fn(() => true),
            assertManagedByShop: vi.fn(async () => undefined),
        };
        service = new InStoreBillService(connection, couponService);
    });

    it('券码为空 → COUPON_NOT_FOUND，不查库', async () => {
        const r = await service.quote(ctx, '   ', 10000);
        expect(r).toMatchObject({ ok: false, reason: IN_STORE_REASON.COUPON_NOT_FOUND });
        expect(ccRepo.findOne).not.toHaveBeenCalled();
    });

    it('券不存在 → COUPON_NOT_FOUND', async () => {
        ccRepo.findOne.mockResolvedValueOnce(null);
        const r = await service.quote(ctx, 'C-NOPE-0001', 10000);
        expect(r).toMatchObject({ ok: false, reason: IN_STORE_REASON.COUPON_NOT_FOUND });
    });

    it('模板停用 → TEMPLATE_DISABLED', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ enabled: false }) }));
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 10000);
        expect(r).toMatchObject({ ok: false, reason: IN_STORE_REASON.TEMPLATE_DISABLED });
    });

    it('券已使用 → COUPON_NOT_UNUSED', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ status: 'USED' }));
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 10000);
        expect(r).toMatchObject({ ok: false, reason: IN_STORE_REASON.COUPON_NOT_UNUSED });
    });

    it('券已过期 → COUPON_EXPIRED', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ expiredAt: new Date(Date.now() - 1000) }));
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 10000);
        expect(r).toMatchObject({ ok: false, reason: IN_STORE_REASON.COUPON_EXPIRED });
    });

    it('场景为 ONLINE → SCENE_MISMATCH', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'ONLINE' }) }));
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 10000);
        expect(r).toMatchObject({ ok: false, reason: IN_STORE_REASON.SCENE_MISMATCH });
    });

    it('场景为 ALL 放行', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'ALL' }) }));
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 10000);
        expect(r).toMatchObject({ ok: true, finalAmount: 8000 });
    });

    it('跨渠道 → TENANT_MISMATCH（渠道判断返回 false）', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE' }) }));
        couponService.templateBelongsToChannel.mockReturnValueOnce(false);
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 10000);
        expect(r).toMatchObject({ ok: false, reason: IN_STORE_REASON.TENANT_MISMATCH });
    });

    it('非本店券（assertManagedByShop 抛错）→ TENANT_MISMATCH', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE', shopId: 88 }) }));
        couponService.assertManagedByShop.mockRejectedValueOnce(new Error('COUPON_NOT_OWNED'));
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 10000);
        expect(r).toMatchObject({ ok: false, reason: IN_STORE_REASON.TENANT_MISMATCH });
    });

    it('originalAmount 省略 → 只回券信息，金额字段为 null', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE' }) }));
        const r = await service.quote(ctx, 'C-ABCD-EFGH');
        expect(r).toMatchObject({
            ok: true,
            couponCode: 'C-ABCD-EFGH',
            couponName: '到店 8 折',
            discountType: 'PERCENT',
            discountValue: 80,
            finalAmount: null,
        });
        expect(r.customerName).toBe('三 张');
        expect(r.customerPhone).toBe('13800000000');
    });

    it('试算成功：8 折券原价 20000 → 优惠 4000 / 实付 16000（并回券信息）', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE' }) }));
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 20000);
        expect(r).toMatchObject({
            ok: true, originalAmount: 20000, discountAmount: 4000, finalAmount: 16000, couponName: '到店 8 折',
        });
    });

    it('未达门槛 → ok=false + MIN_SPEND_NOT_MET，但仍带回券信息（供页面展示券卡）', async () => {
        ccRepo.findOne.mockResolvedValueOnce(
            ccStub({ template: tplStub({ usageScene: 'IN_STORE', minSpend: 10000 }) }),
        );
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 5000);
        expect(r).toMatchObject({ ok: false, reason: IN_STORE_REASON.MIN_SPEND_NOT_MET, couponName: '到店 8 折' });
        expect(r.finalAmount).toBeNull();
    });

    it('查询券时按 code 且带 template.channels 关系', async () => {
        ccRepo.findOne.mockResolvedValueOnce(null);
        await service.quote(ctx, 'C-ABCD-EFGH', 10000);
        expect(ccRepo.findOne).toHaveBeenCalledWith({
            where: { code: 'C-ABCD-EFGH' },
            relations: { template: { channels: true } },
        });
    });
});
