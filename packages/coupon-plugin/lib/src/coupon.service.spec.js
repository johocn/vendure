"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const core_1 = require("@vendure/core");
const coupon_service_1 = require("./coupon.service");
const coupon_template_entity_1 = require("./coupon-template.entity");
const product_coupon_binding_entity_1 = require("./product-coupon-binding.entity");
const coupon_runtime_1 = require("./coupon-runtime");
/**
 * CouponService.claimProductCoupon 纯单元测试：mock TransactionalConnection，
 * 验证渠道隔离（跨渠道领券拒绝）及既有行为回归（enabled / claimable 校验），不落库。
 */
(0, vitest_1.describe)('CouponService.claimProductCoupon', () => {
    let bindingRepo;
    let connection;
    let service;
    (0, vitest_1.beforeEach)(() => {
        bindingRepo = { findOne: vitest_1.vi.fn() };
        connection = {
            getRepository: vitest_1.vi.fn((_ctx, entity) => {
                if (entity === product_coupon_binding_entity_1.ProductCouponBinding)
                    return bindingRepo;
                throw new Error(`unknown entity: ${entity}`);
            }),
        };
        service = new coupon_service_1.CouponService(connection, {}, {});
    });
    const ctx = { channel: { id: 37 } };
    (0, vitest_1.it)('跨渠道 binding（channelId=1，ctx.channel.id=37）→ UserInputError Binding not found，不调 claimCoupon', async () => {
        bindingRepo.findOne.mockResolvedValue({
            id: 1,
            channelId: 1,
            enabled: true,
            couponTemplateId: 10,
            template: { claimable: true },
        });
        const claimSpy = vitest_1.vi.spyOn(service, 'claimCoupon').mockResolvedValue({});
        await (0, vitest_1.expect)(service.claimProductCoupon(ctx, 1)).rejects.toThrow('Binding not found');
        (0, vitest_1.expect)(claimSpy).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('同渠道 binding（channelId=37，ctx.channel.id=37）→ 走 claimCoupon', async () => {
        bindingRepo.findOne.mockResolvedValue({
            id: 1,
            channelId: 37,
            enabled: true,
            couponTemplateId: 10,
            template: { claimable: true },
        });
        const mockCoupon = { id: 9 };
        const claimSpy = vitest_1.vi.spyOn(service, 'claimCoupon').mockResolvedValue(mockCoupon);
        const result = await service.claimProductCoupon(ctx, 1);
        (0, vitest_1.expect)(claimSpy).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(claimSpy).toHaveBeenCalledWith(ctx, 10);
        (0, vitest_1.expect)(result).toBe(mockCoupon);
    });
    (0, vitest_1.it)('binding.enabled=false → 仍报 Binding not found（既有行为）', async () => {
        bindingRepo.findOne.mockResolvedValue({
            id: 1,
            channelId: 37,
            enabled: false,
            couponTemplateId: 10,
            template: { claimable: true },
        });
        const claimSpy = vitest_1.vi.spyOn(service, 'claimCoupon').mockResolvedValue({});
        await (0, vitest_1.expect)(service.claimProductCoupon(ctx, 1)).rejects.toThrow('Binding not found');
        (0, vitest_1.expect)(claimSpy).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('模板非 claimable → 报 Coupon is not claimable（既有行为，回归）', async () => {
        bindingRepo.findOne.mockResolvedValue({
            id: 1,
            channelId: 37,
            enabled: true,
            couponTemplateId: 10,
            template: { claimable: false },
        });
        const claimSpy = vitest_1.vi.spyOn(service, 'claimCoupon').mockResolvedValue({});
        await (0, vitest_1.expect)(service.claimProductCoupon(ctx, 1)).rejects.toThrow('Coupon is not claimable');
        (0, vitest_1.expect)(claimSpy).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('不限渠道（channelId=null）→ 走 claimCoupon', async () => {
        bindingRepo.findOne.mockResolvedValue({
            id: 1,
            channelId: null,
            enabled: true,
            couponTemplateId: 10,
            template: { claimable: true },
        });
        const claimSpy = vitest_1.vi.spyOn(service, 'claimCoupon').mockResolvedValue({});
        await service.claimProductCoupon(ctx, 1);
        (0, vitest_1.expect)(claimSpy).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(claimSpy).toHaveBeenCalledWith(ctx, 10);
    });
});
/**
 * CouponService.redeemByClaimCode 纯单元测试：mock TransactionalConnection，
 * 验证凭码兑换时按当前渠道过滤候选模板，区分「无码」与「渠道不符」错误。
 */
(0, vitest_1.describe)('CouponService.redeemByClaimCode', () => {
    let templateRepo;
    let connection;
    let service;
    (0, vitest_1.beforeEach)(() => {
        templateRepo = { find: vitest_1.vi.fn() };
        connection = {
            getRepository: vitest_1.vi.fn((_ctx, entity) => {
                if (entity === coupon_template_entity_1.CouponTemplate)
                    return templateRepo;
                throw new Error(`unknown entity: ${entity}`);
            }),
        };
        service = new coupon_service_1.CouponService(connection, {}, {});
    });
    const ctx = { channelId: 37 };
    (0, vitest_1.it)('多候选，命中当前渠道（tplB channels=[{id:37}]）→ 仅调一次 claimCoupon(ctx,2)', async () => {
        templateRepo.find.mockResolvedValue([
            { id: 1, claimCode: 'X', channels: [{ id: 1 }] },
            { id: 2, claimCode: 'X', channels: [{ id: 37 }] },
        ]);
        const mockCoupon = { id: 9 };
        const claimSpy = vitest_1.vi.spyOn(service, 'claimCoupon').mockResolvedValue(mockCoupon);
        const result = await service.redeemByClaimCode(ctx, 'X');
        (0, vitest_1.expect)(claimSpy).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(claimSpy).toHaveBeenCalledWith(ctx, 2);
        (0, vitest_1.expect)(result).toBe(mockCoupon);
    });
    (0, vitest_1.it)('有码但当前渠道无归属（channels=[{id:37}]，ctx.channelId=1）→ 拒绝', async () => {
        templateRepo.find.mockResolvedValue([
            { id: 1, claimCode: 'X', channels: [{ id: 37 }] },
        ]);
        const otherCtx = { channelId: 1 };
        const claimSpy = vitest_1.vi.spyOn(service, 'claimCoupon').mockResolvedValue({});
        await (0, vitest_1.expect)(service.redeemByClaimCode(otherCtx, 'X')).rejects.toThrow('Claim code not available in this shop');
        (0, vitest_1.expect)(claimSpy).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('无候选（返回 []）→ 拒绝 Invalid claim code', async () => {
        templateRepo.find.mockResolvedValue([]);
        const claimSpy = vitest_1.vi.spyOn(service, 'claimCoupon').mockResolvedValue({});
        await (0, vitest_1.expect)(service.redeemByClaimCode(ctx, 'X')).rejects.toThrow('Invalid claim code');
        (0, vitest_1.expect)(claimSpy).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('单候选渠道匹配 → 正常 claimCoupon', async () => {
        templateRepo.find.mockResolvedValue([
            { id: 5, claimCode: 'X', channels: [{ id: 37 }] },
        ]);
        const mockCoupon = { id: 9 };
        const claimSpy = vitest_1.vi.spyOn(service, 'claimCoupon').mockResolvedValue(mockCoupon);
        const result = await service.redeemByClaimCode(ctx, 'X');
        (0, vitest_1.expect)(claimSpy).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(claimSpy).toHaveBeenCalledWith(ctx, 5);
        (0, vitest_1.expect)(result).toBe(mockCoupon);
    });
});
/**
 * CouponService.hasPlacedOrder 委托单测：验证其不再自建 query builder，
 * 而是委托 coupon-settlement 的统一口径 isNewCustomerWithinChannel（含渠道过滤）后取反。
 */
(0, vitest_1.describe)('CouponService.hasPlacedOrder 委托', () => {
    let connection;
    let orderRepo;
    let qb;
    let service;
    (0, vitest_1.beforeEach)(() => {
        qb = {
            innerJoin: vitest_1.vi.fn().mockReturnThis(),
            where: vitest_1.vi.fn().mockReturnThis(),
            andWhere: vitest_1.vi.fn().mockReturnThis(),
            getCount: vitest_1.vi.fn().mockResolvedValue(1),
        };
        orderRepo = { createQueryBuilder: vitest_1.vi.fn().mockReturnValue(qb) };
        connection = {
            getRepository: vitest_1.vi.fn((_ctx, entity) => {
                if (entity === core_1.Order)
                    return orderRepo;
                throw new Error(`unknown entity: ${entity}`);
            }),
        };
        (0, coupon_runtime_1.setCouponConnection)(connection);
        service = new coupon_service_1.CouponService(connection, {}, {});
    });
    const ctx = { channelId: 37 };
    (0, vitest_1.it)('本渠道已有有效订单（count=1）→ hasPlacedOrder 返回 true，且 innerJoin 渠道过滤', async () => {
        (0, vitest_1.expect)(await service.hasPlacedOrder(ctx, 5)).toBe(true);
        (0, vitest_1.expect)(qb.innerJoin).toHaveBeenCalledWith('o.channels', 'ch');
        (0, vitest_1.expect)(qb.andWhere).toHaveBeenCalledWith('ch.id = :chan', { chan: ctx.channelId });
    });
    (0, vitest_1.it)('本渠道无有效订单（count=0）→ hasPlacedOrder 返回 false', async () => {
        qb.getCount.mockResolvedValueOnce(0);
        (0, vitest_1.expect)(await service.hasPlacedOrder(ctx, 5)).toBe(false);
    });
});
/**
 * CouponService 私有 countHeld 行为断言：mock TransactionalConnection.rawConnection，
 * 验证「当前可取用券」计数口径 —— 仅 status IN ('UNUSED','RETURNED') 且未过期才占用领用名额。
 */
(0, vitest_1.describe)('CouponService.countHeld', () => {
    let ccRepo;
    let qb;
    let connection;
    let service;
    (0, vitest_1.beforeEach)(() => {
        qb = {
            where: vitest_1.vi.fn().mockReturnThis(),
            andWhere: vitest_1.vi.fn().mockReturnThis(),
            getCount: vitest_1.vi.fn().mockResolvedValue(0),
        };
        ccRepo = { createQueryBuilder: vitest_1.vi.fn().mockReturnValue(qb) };
        connection = {
            getRepository: vitest_1.vi.fn(),
            rawConnection: {
                getRepository: vitest_1.vi.fn((_entity) => ccRepo),
            },
        };
        service = new coupon_service_1.CouponService(connection, {}, {});
    });
    (0, vitest_1.it)('status=USED（已用）不计入 → countHeld 返回 0', async () => {
        qb.getCount.mockResolvedValueOnce(0);
        (0, vitest_1.expect)(await service.countHeld(5, 10, new Date('2026-01-01'))).toBe(0);
        (0, vitest_1.expect)(ccRepo.createQueryBuilder).toHaveBeenCalledWith('cc');
    });
    (0, vitest_1.it)('status=RETURNED 仍计入 → countHeld 返回 1', async () => {
        qb.getCount.mockResolvedValueOnce(1);
        (0, vitest_1.expect)(await service.countHeld(5, 10, new Date('2026-01-01'))).toBe(1);
    });
    (0, vitest_1.it)('status=UNUSED 且 expiredAt < now → 不计入', async () => {
        qb.getCount.mockResolvedValueOnce(0);
        (0, vitest_1.expect)(await service.countHeld(5, 10, new Date('2026-01-01'))).toBe(0);
    });
    (0, vitest_1.it)('status=UNUSED 且 expiredAt IS NULL → 计入', async () => {
        qb.getCount.mockResolvedValueOnce(1);
        (0, vitest_1.expect)(await service.countHeld(5, 10, new Date('2026-01-01'))).toBe(1);
    });
    (0, vitest_1.it)('status=UNUSED 且 expiredAt > now → 计入', async () => {
        qb.getCount.mockResolvedValueOnce(1);
        (0, vitest_1.expect)(await service.countHeld(5, 10, new Date('2026-01-01'))).toBe(1);
    });
    (0, vitest_1.it)('过滤条件包含 status IN (UNUSED,RETURNED) 与未过期判定（含 IS NULL 与 now 参数）', async () => {
        const now = new Date('2026-03-05T10:00:00.000Z');
        await service.countHeld(7, 20, now);
        (0, vitest_1.expect)(qb.andWhere).toHaveBeenCalledWith("cc.status IN ('UNUSED','RETURNED')");
        (0, vitest_1.expect)(qb.andWhere).toHaveBeenCalledWith('(cc.expiredAt IS NULL OR cc.expiredAt > :now)', { now: now.toISOString() });
        (0, vitest_1.expect)(qb.andWhere).not.toHaveBeenCalledWith("cc.status NOT IN ('RETURNED','INVALID','EXPIRED')");
        (0, vitest_1.expect)(ccRepo.createQueryBuilder).toHaveBeenCalledWith('cc');
    });
});
//# sourceMappingURL=coupon.service.spec.js.map