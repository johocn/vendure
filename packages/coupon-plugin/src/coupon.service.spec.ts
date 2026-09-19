import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Order } from '@vendure/core';

import { CouponService } from './coupon.service';
import { CouponTemplate } from './coupon-template.entity';
import { ProductCouponBinding } from './product-coupon-binding.entity';
import { CustomerCoupon } from './customer-coupon.entity';
import { setCouponConnection } from './coupon-runtime';

/**
 * CouponService.claimProductCoupon 纯单元测试：mock TransactionalConnection，
 * 验证渠道隔离（跨渠道领券拒绝）及既有行为回归（enabled / claimable 校验），不落库。
 */
describe('CouponService.claimProductCoupon', () => {
    let bindingRepo: any;
    let connection: any;
    let service: CouponService;

    beforeEach(() => {
        bindingRepo = { findOne: vi.fn() };
        connection = {
            getRepository: vi.fn((_ctx: any, entity: any) => {
                if (entity === ProductCouponBinding) return bindingRepo;
                throw new Error(`unknown entity: ${entity}`);
            }),
        };
        service = new CouponService(connection as any, {} as any, {} as any);
    });

    const ctx: any = { channel: { id: 37 } };

    it('跨渠道 binding（channelId=1，ctx.channel.id=37）→ UserInputError Binding not found，不调 claimCoupon', async () => {
        bindingRepo.findOne.mockResolvedValue({
            id: 1,
            channelId: 1,
            enabled: true,
            couponTemplateId: 10,
            template: { claimable: true },
        });
        const claimSpy = vi.spyOn(service, 'claimCoupon').mockResolvedValue({} as any);

        await expect(service.claimProductCoupon(ctx, 1 as any)).rejects.toThrow('Binding not found');
        expect(claimSpy).not.toHaveBeenCalled();
    });

    it('同渠道 binding（channelId=37，ctx.channel.id=37）→ 走 claimCoupon', async () => {
        bindingRepo.findOne.mockResolvedValue({
            id: 1,
            channelId: 37,
            enabled: true,
            couponTemplateId: 10,
            template: { claimable: true },
        });
        const mockCoupon = { id: 9 } as any;
        const claimSpy = vi.spyOn(service, 'claimCoupon').mockResolvedValue(mockCoupon);

        const result = await service.claimProductCoupon(ctx, 1 as any);

        expect(claimSpy).toHaveBeenCalledTimes(1);
        expect(claimSpy).toHaveBeenCalledWith(ctx, 10);
        expect(result).toBe(mockCoupon);
    });

    it('binding.enabled=false → 仍报 Binding not found（既有行为）', async () => {
        bindingRepo.findOne.mockResolvedValue({
            id: 1,
            channelId: 37,
            enabled: false,
            couponTemplateId: 10,
            template: { claimable: true },
        });
        const claimSpy = vi.spyOn(service, 'claimCoupon').mockResolvedValue({} as any);

        await expect(service.claimProductCoupon(ctx, 1 as any)).rejects.toThrow('Binding not found');
        expect(claimSpy).not.toHaveBeenCalled();
    });

    it('模板非 claimable → 报 Coupon is not claimable（既有行为，回归）', async () => {
        bindingRepo.findOne.mockResolvedValue({
            id: 1,
            channelId: 37,
            enabled: true,
            couponTemplateId: 10,
            template: { claimable: false },
        });
        const claimSpy = vi.spyOn(service, 'claimCoupon').mockResolvedValue({} as any);

        await expect(service.claimProductCoupon(ctx, 1 as any)).rejects.toThrow('Coupon is not claimable');
        expect(claimSpy).not.toHaveBeenCalled();
    });

    it('不限渠道（channelId=null）→ 走 claimCoupon', async () => {
        bindingRepo.findOne.mockResolvedValue({
            id: 1,
            channelId: null,
            enabled: true,
            couponTemplateId: 10,
            template: { claimable: true },
        });
        const claimSpy = vi.spyOn(service, 'claimCoupon').mockResolvedValue({} as any);

        await service.claimProductCoupon(ctx, 1 as any);

        expect(claimSpy).toHaveBeenCalledTimes(1);
        expect(claimSpy).toHaveBeenCalledWith(ctx, 10);
    });
});

/**
 * CouponService.redeemByClaimCode 纯单元测试：mock TransactionalConnection，
 * 验证凭码兑换时按当前渠道过滤候选模板，区分「无码」与「渠道不符」错误。
 */
describe('CouponService.redeemByClaimCode', () => {
    let templateRepo: any;
    let connection: any;
    let service: CouponService;

    beforeEach(() => {
        templateRepo = { find: vi.fn() };
        connection = {
            getRepository: vi.fn((_ctx: any, entity: any) => {
                if (entity === CouponTemplate) return templateRepo;
                throw new Error(`unknown entity: ${entity}`);
            }),
        };
        service = new CouponService(connection as any, {} as any, {} as any);
    });

    const ctx: any = { channelId: 37 };

    it('多候选，命中当前渠道（tplB channels=[{id:37}]）→ 仅调一次 claimCoupon(ctx,2)', async () => {
        templateRepo.find.mockResolvedValue([
            { id: 1, claimCode: 'X', channels: [{ id: 1 }] },
            { id: 2, claimCode: 'X', channels: [{ id: 37 }] },
        ]);
        const mockCoupon = { id: 9 } as any;
        const claimSpy = vi.spyOn(service, 'claimCoupon').mockResolvedValue(mockCoupon);

        const result = await service.redeemByClaimCode(ctx, 'X' as any);

        expect(claimSpy).toHaveBeenCalledTimes(1);
        expect(claimSpy).toHaveBeenCalledWith(ctx, 2);
        expect(result).toBe(mockCoupon);
    });

    it('有码但当前渠道无归属（channels=[{id:37}]，ctx.channelId=1）→ 拒绝', async () => {
        templateRepo.find.mockResolvedValue([
            { id: 1, claimCode: 'X', channels: [{ id: 37 }] },
        ]);
        const otherCtx: any = { channelId: 1 };
        const claimSpy = vi.spyOn(service, 'claimCoupon').mockResolvedValue({} as any);

        await expect(service.redeemByClaimCode(otherCtx, 'X' as any)).rejects.toThrow('Claim code not available in this shop');
        expect(claimSpy).not.toHaveBeenCalled();
    });

    it('无候选（返回 []）→ 拒绝 Invalid claim code', async () => {
        templateRepo.find.mockResolvedValue([]);
        const claimSpy = vi.spyOn(service, 'claimCoupon').mockResolvedValue({} as any);

        await expect(service.redeemByClaimCode(ctx, 'X' as any)).rejects.toThrow('Invalid claim code');
        expect(claimSpy).not.toHaveBeenCalled();
    });

    it('单候选渠道匹配 → 正常 claimCoupon', async () => {
        templateRepo.find.mockResolvedValue([
            { id: 5, claimCode: 'X', channels: [{ id: 37 }] },
        ]);
        const mockCoupon = { id: 9 } as any;
        const claimSpy = vi.spyOn(service, 'claimCoupon').mockResolvedValue(mockCoupon);

        const result = await service.redeemByClaimCode(ctx, 'X' as any);

        expect(claimSpy).toHaveBeenCalledTimes(1);
        expect(claimSpy).toHaveBeenCalledWith(ctx, 5);
        expect(result).toBe(mockCoupon);
    });
});

/**
 * CouponService.hasPlacedOrder 委托单测：验证其不再自建 query builder，
 * 而是委托 coupon-settlement 的统一口径 isNewCustomerWithinChannel（含渠道过滤）后取反。
 */
describe('CouponService.hasPlacedOrder 委托', () => {
    let connection: any;
    let orderRepo: any;
    let qb: any;
    let service: CouponService;

    beforeEach(() => {
        qb = {
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            getCount: vi.fn().mockResolvedValue(1),
        };
        orderRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
        connection = {
            getRepository: vi.fn((_ctx: any, entity: any) => {
                if (entity === Order) return orderRepo;
                throw new Error(`unknown entity: ${entity}`);
            }),
        };
        setCouponConnection(connection);
        service = new CouponService(connection as any, {} as any, {} as any);
    });

    const ctx: any = { channelId: 37 };

    it('本渠道已有有效订单（count=1）→ hasPlacedOrder 返回 true，且走 channelId 过滤', async () => {
        expect(await (service as any).hasPlacedOrder(ctx, 5)).toBe(true);
        expect(qb.andWhere).toHaveBeenCalledWith('o.channelId = :chan', { chan: ctx.channelId });
    });

    it('本渠道无有效订单（count=0）→ hasPlacedOrder 返回 false', async () => {
        qb.getCount.mockResolvedValueOnce(0);
        expect(await (service as any).hasPlacedOrder(ctx, 5)).toBe(false);
    });
});

/**
 * CouponService 私有 countHeld 行为断言：mock TransactionalConnection.rawConnection，
 * 验证「当前可取用券」计数口径 —— 仅 status IN ('UNUSED','RETURNED') 且未过期才占用领用名额。
 */
describe('CouponService.countHeld', () => {
    let ccRepo: any;
    let qb: any;
    let connection: any;
    let service: CouponService;

    beforeEach(() => {
        qb = {
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            getCount: vi.fn().mockResolvedValue(0),
        };
        ccRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
        connection = {
            getRepository: vi.fn(),
            rawConnection: {
                getRepository: vi.fn((_entity: any) => ccRepo),
            },
        };
        service = new CouponService(connection as any, {} as any, {} as any);
    });

    it('status=USED（已用）不计入 → countHeld 返回 0', async () => {
        qb.getCount.mockResolvedValueOnce(0);
        expect(await (service as any).countHeld(5, 10, new Date('2026-01-01'))).toBe(0);
        expect(ccRepo.createQueryBuilder).toHaveBeenCalledWith('cc');
    });

    it('status=RETURNED 仍计入 → countHeld 返回 1', async () => {
        qb.getCount.mockResolvedValueOnce(1);
        expect(await (service as any).countHeld(5, 10, new Date('2026-01-01'))).toBe(1);
    });

    it('status=UNUSED 且 expiredAt < now → 不计入', async () => {
        qb.getCount.mockResolvedValueOnce(0);
        expect(await (service as any).countHeld(5, 10, new Date('2026-01-01'))).toBe(0);
    });

    it('status=UNUSED 且 expiredAt IS NULL → 计入', async () => {
        qb.getCount.mockResolvedValueOnce(1);
        expect(await (service as any).countHeld(5, 10, new Date('2026-01-01'))).toBe(1);
    });

    it('status=UNUSED 且 expiredAt > now → 计入', async () => {
        qb.getCount.mockResolvedValueOnce(1);
        expect(await (service as any).countHeld(5, 10, new Date('2026-01-01'))).toBe(1);
    });

    it('过滤条件包含 status IN (UNUSED,RETURNED) 与未过期判定（含 IS NULL 与 now 参数）', async () => {
        const now = new Date('2026-03-05T10:00:00.000Z');
        await (service as any).countHeld(7, 20, now);

        expect(qb.andWhere).toHaveBeenCalledWith("cc.status IN ('UNUSED','RETURNED')");
        expect(qb.andWhere).toHaveBeenCalledWith(
            '(cc.expiredAt IS NULL OR cc.expiredAt > :now)',
            { now: now.toISOString() },
        );
        expect(qb.andWhere).not.toHaveBeenCalledWith(
            "cc.status NOT IN ('RETURNED','INVALID','EXPIRED')",
        );
        expect(ccRepo.createQueryBuilder).toHaveBeenCalledWith('cc');
    });
});