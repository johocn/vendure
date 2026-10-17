import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Administrator, Customer } from '@vendure/core';

import { InStoreBill } from './in-store-bill.entity';
import { InStoreBillService } from './in-store-bill.service';
import { IN_STORE_REASON } from './in-store-bill';
import { CustomerCoupon } from './customer-coupon.entity';
import { setRedeemScopeResolver } from './redeem-scope';

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

describe('InStoreBillService.redeem', () => {
    const ctx: any = { channelId: 3, activeUserId: 99, languageCode: 'zh_Hans' };

    let ccRepo: any;
    let billRepo: any;
    let updateQb: any;
    let connection: any;
    let couponService: any;
    let service: InStoreBillService;

    beforeEach(() => {
        updateQb = {
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn(async () => ({ affected: 1 })),
        };
        ccRepo = { findOne: vi.fn(), createQueryBuilder: vi.fn(() => updateQb) };
        billRepo = { save: vi.fn(async (b: any) => ({ id: 21, ...b })) };
        connection = {
            getRepository: vi.fn((_c: any, entity: any) => {
                if (entity === CustomerCoupon) return ccRepo;
                if (entity === InStoreBill) return billRepo;
                if (entity === Customer) return { findOne: vi.fn(async () => ({ firstName: '三', lastName: '张', phoneNumber: '13800000000' })) };
                if (entity === Administrator) return { findOne: vi.fn(async () => ({ firstName: '掌', lastName: '柜' })) };
                throw new Error(`unknown entity: ${entity?.name}`);
            }),
        };
        couponService = {
            templateBelongsToChannel: vi.fn(() => true),
            assertManagedByShop: vi.fn(async () => undefined),
        };
        service = new InStoreBillService(connection, couponService);
    });

    it('成功核销：条件更新置 USED → 写流水（含券/顾客/核销人/金额快照）', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE' }) }));
        const bill: any = await service.redeem(ctx, ' C-ABCD-EFGH ', 20000, '老客户');

        expect(updateQb.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'USED' }));
        expect(updateQb.where).toHaveBeenCalledWith('id = :id AND status = :unused', {
            id: 11,
            unused: 'UNUSED',
        });
        expect(bill).toMatchObject({
            id: 21,
            channelId: 3,
            customerCouponId: 11,
            couponCode: 'C-ABCD-EFGH',
            couponTemplateId: 7,
            couponName: '到店 8 折',
            customerId: 5,
            customerName: '三 张',
            customerPhone: '13800000000',
            discountType: 'PERCENT',
            discountValue: 80,
            originalAmount: 20000,
            discountAmount: 4000,
            finalAmount: 16000,
            operatorId: 99,
            operatorName: '掌 柜',
            remark: '老客户',
        });
        expect(bill.billedAt).toBeInstanceOf(Date);
    });

    it('券不存在 → 抛 UserInputError（优惠券不存在），不写流水', async () => {
        ccRepo.findOne.mockResolvedValueOnce(null);
        await expect(service.redeem(ctx, 'C-NOPE-0001', 20000)).rejects.toThrow('优惠券不存在');
        expect(billRepo.save).not.toHaveBeenCalled();
        expect(updateQb.execute).not.toHaveBeenCalled();
    });

    it('未达门槛 → 抛 UserInputError，不置 USED、不写流水', async () => {
        ccRepo.findOne.mockResolvedValueOnce(
            ccStub({ template: tplStub({ usageScene: 'IN_STORE', minSpend: 10000 }) }),
        );
        await expect(service.redeem(ctx, 'C-ABCD-EFGH', 5000)).rejects.toThrow('未达到该券使用门槛');
        expect(updateQb.execute).not.toHaveBeenCalled();
        expect(billRepo.save).not.toHaveBeenCalled();
    });

    it('并发/重复核销（affectedRows=0）→ 抛 COUPON_NOT_UNUSED 文案，不写流水', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE' }) }));
        updateQb.execute.mockResolvedValueOnce({ affected: 0 });
        await expect(service.redeem(ctx, 'C-ABCD-EFGH', 20000)).rejects.toThrow('该优惠券已使用或当前不可用');
        expect(billRepo.save).not.toHaveBeenCalled();
    });

    it('FREE_SHIPPING 券 → 抛类型不支持文案', async () => {
        ccRepo.findOne.mockResolvedValueOnce(
            ccStub({ template: tplStub({ usageScene: 'IN_STORE', type: 'FREE_SHIPPING' }) }),
        );
        await expect(service.redeem(ctx, 'C-ABCD-EFGH', 20000)).rejects.toThrow('该券类型不支持到店买单');
    });

    it('非法原价（0）→ 抛金额文案', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE' }) }));
        await expect(service.redeem(ctx, 'C-ABCD-EFGH', 0)).rejects.toThrow('请输入有效的消费金额');
    });
});

describe('InStoreBillService.list / summary', () => {
    const ctx: any = { channelId: 3, activeUserId: 99, languageCode: 'zh_Hans' };

    let listQb: any;
    let connection: any;
    let service: InStoreBillService;

    beforeEach(() => {
        listQb = {
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            addOrderBy: vi.fn().mockReturnThis(),
            skip: vi.fn().mockReturnThis(),
            take: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            addSelect: vi.fn().mockReturnThis(),
            getManyAndCount: vi.fn(async () => [[{ id: 1 }], 1]),
            getRawOne: vi.fn(async () => ({ count: '3', originalTotal: '30000', discountTotal: '6000', finalTotal: '24000' })),
        };
        connection = {
            getRepository: vi.fn(() => ({ createQueryBuilder: vi.fn(() => listQb) })),
        };
        service = new InStoreBillService(connection, {} as any);
    });

    it('list：强制按 ctx.channelId 过滤，默认时间倒序 + 分页上限 200', async () => {
        await service.list(ctx, { skip: 0, take: 500 });
        expect(listQb.where).toHaveBeenCalledWith('b.channelId = :channelId', { channelId: 3 });
        expect(listQb.orderBy).toHaveBeenCalledWith('b.billedAt', 'DESC');
        expect(listQb.addOrderBy).toHaveBeenCalledWith('b.id', 'DESC');
        expect(listQb.take).toHaveBeenCalledWith(200);
    });

    it('list：券码 / 时间区间筛选生效', async () => {
        const from = new Date('2026-10-01T00:00:00.000Z');
        const to = new Date('2026-10-31T23:59:59.999Z');
        await service.list(ctx, { couponCode: 'C-ABCD-EFGH', from, to });
        expect(listQb.andWhere).toHaveBeenCalledWith('b.couponCode = :code', { code: 'C-ABCD-EFGH' });
        expect(listQb.andWhere).toHaveBeenCalledWith('b.billedAt >= :from', { from });
        expect(listQb.andWhere).toHaveBeenCalledWith('b.billedAt <= :to', { to });
    });

    it('summary：字符串聚合值转数字，并按渠道 isolate', async () => {
        const s = await service.summary(ctx, {});
        expect(listQb.where).toHaveBeenCalledWith('b.channelId = :channelId', { channelId: 3 });
        expect(s).toEqual({ count: 3, originalTotal: 30000, discountTotal: 6000, finalTotal: 24000 });
    });

    it('summary：空结果回退 0', async () => {
        listQb.getRawOne.mockResolvedValueOnce({ count: null, originalTotal: null, discountTotal: null, finalTotal: null });
        expect(await service.summary(ctx, {})).toEqual({
            count: 0, originalTotal: 0, discountTotal: 0, finalTotal: 0,
        });
    });
});

describe('InStoreBillService.listPending（核销页默认待核销券列表）', () => {
    const ctx: any = { channelId: 3, activeUserId: 99, languageCode: 'zh_Hans' };

    let pendingQb: any;
    let customerRepo: any;
    let connection: any;
    let couponService: any;
    let service: InStoreBillService;

    /** 三张候选券：id 11/12/13，过期时间 10-31 / 无 / 10-20（SQL 已按临期优先排序返回） */
    function candidates(): any[] {
        return [
            ccStub({ id: 11, code: 'C-AAAA-0001', customerId: 5, template: tplStub({ usageScene: 'IN_STORE', expiredAt: undefined }) }),
            ccStub({ id: 12, code: 'C-BBBB-0002', customerId: 6, expiredAt: null, template: tplStub({ id: 8, name: '通用到店券', usageScene: 'ALL' }) }),
            ccStub({ id: 13, code: 'C-CCCC-0003', customerId: 7, template: tplStub({ id: 9, name: '他渠道券', usageScene: 'IN_STORE' }) }),
        ];
    }

    beforeEach(() => {
        pendingQb = {
            leftJoinAndSelect: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            addOrderBy: vi.fn().mockReturnThis(),
            take: vi.fn().mockReturnThis(),
            getMany: vi.fn(async () => candidates()),
        };
        customerRepo = { findOne: vi.fn(async () => ({ firstName: '三', lastName: '张', phoneNumber: '13800000000' })) };
        connection = {
            getRepository: vi.fn((_c: any, entity: any) => {
                if (entity === CustomerCoupon) return { createQueryBuilder: vi.fn(() => pendingQb) };
                if (entity === Customer) return customerRepo;
                throw new Error(`unknown entity: ${entity?.name}`);
            }),
        };
        couponService = {
            templateBelongsToChannel: vi.fn(() => true),
            resolveShopIdFromActiveUser: vi.fn(async () => undefined),
        };
        service = new InStoreBillService(connection, couponService);
    });
    afterEach(() => setRedeemScopeResolver(null));

    it('默认：固定过滤条件 + 临期优先排序 + 候选集上限 500 + 默认分页 20', async () => {
        const r = await service.listPending(ctx, {});
        expect(pendingQb.where).toHaveBeenCalledWith('cc.status = :status', { status: 'UNUSED' });
        expect(pendingQb.andWhere).toHaveBeenCalledWith('tpl.enabled = :enabled', { enabled: true });
        expect(pendingQb.andWhere).toHaveBeenCalledWith('(tpl.usageScene = :sceneStore OR tpl.usageScene = :sceneAll)', {
            sceneStore: 'IN_STORE', sceneAll: 'ALL',
        });
        expect(pendingQb.andWhere).toHaveBeenCalledWith('(cc.expiredAt IS NULL OR cc.expiredAt > :now)', { now: expect.any(Date) });
        expect(pendingQb.orderBy).toHaveBeenCalledWith('cc.expiredAt', 'ASC', 'NULLS LAST');
        expect(pendingQb.take).toHaveBeenCalledWith(500);
        // 超管（无属店）→ 无属店过滤
        expect(pendingQb.andWhere).not.toHaveBeenCalledWith('(tpl.shopId IS NULL OR tpl.shopId = :adminShopId)', expect.anything());
        expect(r.totalItems).toBe(3);
        expect(r.items).toHaveLength(3);
        expect(r.items[0]).toMatchObject({ couponCode: 'C-AAAA-0001', couponName: '到店 8 折', discountType: 'PERCENT', discountValue: 80 });
        expect(r.items[0].customerName).toBe('三 张');
    });

    it('属店管理员 → 追加本店券/平台券过滤', async () => {
        couponService.resolveShopIdFromActiveUser.mockResolvedValueOnce(5);
        await service.listPending(ctx, {});
        expect(pendingQb.andWhere).toHaveBeenCalledWith('(tpl.shopId IS NULL OR tpl.shopId = :adminShopId)', { adminShopId: 5 });
    });

    it('渠道不归属 → 排除；受限核销员范围外模板（通用券）→ 排除，totalItems 为过滤后数量', async () => {
        couponService.templateBelongsToChannel.mockImplementation((_c: any, tpl: any) => tpl.id !== 9);
        setRedeemScopeResolver({
            resolve: vi.fn(async () => ({ restricted: true, shippingProfileIds: ['5'] })),
            orderInScope: vi.fn(async () => true),
            couponTemplateInScope: vi.fn(async (_c: any, templateId: any) => Number(templateId) !== 8),
        });
        const r = await service.listPending(ctx, {});
        expect(r.totalItems).toBe(1);
        expect(r.items.map(i => i.couponCode)).toEqual(['C-AAAA-0001']);
    });

    it('分页在过滤后切片：skip=1 take=1', async () => {
        const r = await service.listPending(ctx, { skip: 1, take: 1 });
        expect(r.totalItems).toBe(3);
        expect(r.items.map(i => i.couponCode)).toEqual(['C-BBBB-0002']);
    });
});

describe('InStoreBillService · 受限核销员（VerifyOrder）范围收口', () => {
    const ctx: any = { channelId: 3, activeUserId: 99, languageCode: 'zh_Hans' };
    const restricted = { restricted: true, shippingProfileIds: ['5'] };

    let ccRepo: any;
    let listQb: any;
    let connection: any;
    let couponService: any;
    let service: InStoreBillService;

    /** 注册受限核销员实现；orderInScope/couponTemplateInScope 由用例指定命中与否 */
    function useProvider(opts: { templateHit?: boolean } = {}) {
        setRedeemScopeResolver({
            resolve: vi.fn(async () => restricted),
            orderInScope: vi.fn(async () => true),
            couponTemplateInScope: vi.fn(async () => opts.templateHit ?? true),
        });
    }

    beforeEach(() => {
        ccRepo = { findOne: vi.fn(), createQueryBuilder: vi.fn() };
        listQb = {
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            addOrderBy: vi.fn().mockReturnThis(),
            skip: vi.fn().mockReturnThis(),
            take: vi.fn().mockReturnThis(),
            getManyAndCount: vi.fn(async () => [[], 0]),
        };
        connection = {
            getRepository: vi.fn((_c: any, entity: any) => {
                if (entity === CustomerCoupon) return ccRepo;
                if (entity === InStoreBill) return { createQueryBuilder: vi.fn(() => listQb) };
                if (entity === Customer) return { findOne: vi.fn(async () => null) };
                if (entity === Administrator) return { findOne: vi.fn(async () => null) };
                throw new Error(`unknown entity: ${entity?.name}`);
            }),
        };
        couponService = {
            templateBelongsToChannel: vi.fn(() => true),
            assertManagedByShop: vi.fn(async () => undefined),
        };
        service = new InStoreBillService(connection, couponService);
    });
    afterEach(() => setRedeemScopeResolver(null));

    it('券模板不在范围（通用券/部分商品越界）→ SCOPE_MISMATCH', async () => {
        useProvider({ templateHit: false });
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE' }) }));
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 10000);
        expect(r).toMatchObject({ ok: false, reason: IN_STORE_REASON.SCOPE_MISMATCH });
    });

    it('券模板全命中 → 放行试算', async () => {
        useProvider({ templateHit: true });
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE' }) }));
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 10000);
        expect(r).toMatchObject({ ok: true, finalAmount: 8000 });
    });

    it('核销时范围外 → 抛 SCOPE_MISMATCH 文案，不占用/不写流水', async () => {
        useProvider({ templateHit: false });
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE' }) }));
        await expect(service.redeem(ctx, 'C-ABCD-EFGH', 10000)).rejects.toThrow('该券不在你的核销范围内');
        expect(ccRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('流水受限 → 追加 operatorId = activeUserId（只看自己经手）', async () => {
        useProvider();
        await service.list(ctx, {});
        expect(listQb.andWhere).toHaveBeenCalledWith('b.operatorId = :operatorId', { operatorId: 99 });
    });

    it('不受限（未注册实现）→ 不追加 operatorId 过滤', async () => {
        setRedeemScopeResolver(null);
        await service.list(ctx, {});
        expect(listQb.andWhere).not.toHaveBeenCalledWith('b.operatorId = :operatorId', expect.anything());
    });
});
