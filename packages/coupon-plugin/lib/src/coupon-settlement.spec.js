"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const core_1 = require("@vendure/core");
const coupon_runtime_1 = require("./coupon-runtime");
const coupon_settlement_1 = require("./coupon-settlement");
/**
 * isNewCustomerWithinChannel 单测：mock coupon-runtime 的连接，
 * 验证统一口径（本租户 channelId 无有效订单）及渠道过滤的 andWhere 是否注入。
 * 不落库。
 */
(0, vitest_1.describe)('isNewCustomerWithinChannel 统一口径', () => {
    const ctx = { channelId: 3, activeUserId: undefined };
    let qb;
    let orderRepo;
    let customerRepo;
    let connection;
    (0, vitest_1.beforeEach)(() => {
        qb = {
            innerJoin: vitest_1.vi.fn().mockReturnThis(),
            where: vitest_1.vi.fn().mockReturnThis(),
            andWhere: vitest_1.vi.fn().mockReturnThis(),
            getCount: vitest_1.vi.fn().mockResolvedValue(0),
        };
        orderRepo = { createQueryBuilder: vitest_1.vi.fn().mockReturnValue(qb) };
        customerRepo = { findOne: vitest_1.vi.fn() };
        connection = {
            getRepository: vitest_1.vi.fn((_c, entity) => {
                if (entity === core_1.Order)
                    return orderRepo;
                if (entity === core_1.Customer)
                    return customerRepo;
                throw new Error(`unknown entity: ${entity}`);
            }),
        };
        (0, coupon_runtime_1.setCouponConnection)(connection);
    });
    (0, vitest_1.it)('customerId 为 null → true，不查库（getCount 不被调用）', async () => {
        (0, vitest_1.expect)(await (0, coupon_settlement_1.isNewCustomerWithinChannel)(ctx, null)).toBe(true);
        (0, vitest_1.expect)(await (0, coupon_settlement_1.isNewCustomerWithinChannel)(ctx, undefined)).toBe(true);
        (0, vitest_1.expect)(qb.getCount).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('本渠道无有效订单（count=0）→ true', async () => {
        (0, vitest_1.expect)(await (0, coupon_settlement_1.isNewCustomerWithinChannel)(ctx, 5)).toBe(true);
        (0, vitest_1.expect)(qb.getCount).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)('本渠道有历史订单（count=1）→ false', async () => {
        qb.getCount.mockResolvedValueOnce(1);
        (0, vitest_1.expect)(await (0, coupon_settlement_1.isNewCustomerWithinChannel)(ctx, 5)).toBe(false);
    });
    (0, vitest_1.it)('渠道过滤：innerJoin o.channels 并按 ch.id = ctx.channelId 过滤', async () => {
        await (0, coupon_settlement_1.isNewCustomerWithinChannel)(ctx, 5);
        (0, vitest_1.expect)(qb.innerJoin).toHaveBeenCalledWith('o.channels', 'ch');
        (0, vitest_1.expect)(qb.andWhere).toHaveBeenCalledWith('ch.id = :chan', { chan: ctx.channelId });
    });
    (0, vitest_1.it)('isNewCustomer 委托：解析 customerId 后走统一口径，null 时短路 true', async () => {
        customerRepo.findOne.mockResolvedValue({ id: 9 });
        await (0, coupon_settlement_1.isNewCustomer)({ channelId: 3, activeUserId: 77 }, { customer: { id: 5 } });
        (0, vitest_1.expect)(qb.getCount).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=coupon-settlement.spec.js.map