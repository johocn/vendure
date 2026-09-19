import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Customer, Order } from '@vendure/core';

import { setCouponConnection } from './coupon-runtime';
import { isNewCustomer, isNewCustomerWithinChannel } from './coupon-settlement';

/**
 * isNewCustomerWithinChannel 单测：mock coupon-runtime 的连接，
 * 验证统一口径（本租户 channelId 无有效订单）及渠道过滤的 andWhere 是否注入。
 * 不落库。
 */
describe('isNewCustomerWithinChannel 统一口径', () => {
    const ctx: any = { channelId: 3, activeUserId: undefined };

    let qb: any;
    let orderRepo: any;
    let customerRepo: any;
    let connection: any;

    beforeEach(() => {
        qb = {
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            getCount: vi.fn().mockResolvedValue(0),
        };
        orderRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
        customerRepo = { findOne: vi.fn() };
        connection = {
            getRepository: vi.fn((_c: any, entity: any) => {
                if (entity === Order) return orderRepo;
                if (entity === Customer) return customerRepo;
                throw new Error(`unknown entity: ${entity}`);
            }),
        };
        setCouponConnection(connection);
    });

    it('customerId 为 null → true，不查库（getCount 不被调用）', async () => {
        expect(await isNewCustomerWithinChannel(ctx, null)).toBe(true);
        expect(await isNewCustomerWithinChannel(ctx, undefined)).toBe(true);
        expect(qb.getCount).not.toHaveBeenCalled();
    });

    it('本渠道无有效订单（count=0）→ true', async () => {
        expect(await isNewCustomerWithinChannel(ctx, 5)).toBe(true);
        expect(qb.getCount).toHaveBeenCalledTimes(1);
    });

    it('本渠道有历史订单（count=1）→ false', async () => {
        qb.getCount.mockResolvedValueOnce(1);
        expect(await isNewCustomerWithinChannel(ctx, 5)).toBe(false);
    });

    it('渠道过滤：必须 andWhere o.channelId = :chan（chan=ctx.channelId）', async () => {
        await isNewCustomerWithinChannel(ctx, 5);
        expect(
            qb.andWhere,
        ).toHaveBeenCalledWith('o.channelId = :chan', { chan: ctx.channelId });
    });

    it('isNewCustomer 委托：解析 customerId 后走统一口径，null 时短路 true', async () => {
        customerRepo.findOne.mockResolvedValue({ id: 9 });
        await isNewCustomer({ channelId: 3, activeUserId: 77 } as any, { customer: { id: 5 } });
        expect(qb.getCount).toHaveBeenCalledTimes(1);
    });
});