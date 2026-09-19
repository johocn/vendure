import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CouponService } from './coupon.service';
import { ProductCouponBinding } from './product-coupon-binding.entity';

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