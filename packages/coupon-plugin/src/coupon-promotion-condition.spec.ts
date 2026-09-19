import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Customer, Order } from '@vendure/core';

import { couponAppliedCondition } from './coupon-promotion-condition';
import { setCouponConnection } from './coupon-runtime';
import { setBindingService } from './coupon-settlement';
import { CustomerCoupon } from './customer-coupon.entity';

/**
 * couponAppliedCondition 结算校验单测：mock coupon-runtime 与 coupon-settlement 两个单例，
 * 验证 ①binding 集合限定命中商品行（唯一权威）②newCustomerOnly 拦截 ③validDays 过期判定。
 * 不落库；channel 用非默认商城，跳过 shopId 行过滤，聚焦 binding 逻辑。
 */
describe('couponAppliedCondition 结算校验', () => {
    let couponRepo: any;
    let customerRepo: any;
    let orderRepo: any;
    let connection: any;
    let bindingService: any;
    let qb: any;

    // 非默认商城（token/code 均不命中默认判据），跳过 shopId 行级过滤
    const ctx: any = {
        channel: { token: 'other-channel', code: 'other-channel', pricesIncludeTax: true },
        activeUserId: undefined,
    };

    /** 订单行：行形状对齐结算期 order.lines（productVariant.product.id 为商品 id） */
    const line = (productId: number, variantId: number, price: number) => ({
        productVariant: { id: variantId, product: { id: productId, customFields: {} } },
        linePrice: price,
        linePriceWithTax: price,
    });

    /** 券实例：默认 UNUSED / FIXED 30 / 无门槛，可覆盖（template 覆盖字段与原值合并） */
    const makeCoupon = (overrides?: any) => {
        const base = {
            status: 'UNUSED',
            expiredAt: null,
            template: {
                id: 1,
                enabled: true,
                startsAt: null,
                endsAt: null,
                shopId: null,
                minSpend: 0,
                type: 'FIXED',
                discountValue: 30,
                newCustomerOnly: false,
                validDays: null,
            },
        };
        return { ...base, ...overrides, template: { ...base.template, ...overrides?.template } };
    };

    beforeEach(() => {
        qb = {
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            getCount: vi.fn().mockResolvedValue(0),
        };
        couponRepo = { findOne: vi.fn() };
        customerRepo = { findOne: vi.fn() };
        orderRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
        connection = {
            getRepository: vi.fn((_ctx: any, entity: any) => {
                if (entity === CustomerCoupon) return couponRepo;
                if (entity === Customer) return customerRepo;
                if (entity === Order) return orderRepo;
                throw new Error(`unknown entity: ${entity}`);
            }),
        };
        bindingService = { listByTemplate: vi.fn() };
        setCouponConnection(connection);
        setBindingService(bindingService);
    });

    it('订单含绑定行+非绑定行 → 只对绑定行算 base，FIXED 封顶命中行小计', async () => {
        // 券 FIXED discountValue=30；绑定行 product 10 linePrice 100，非绑定行 product 20 linePrice 50
        couponRepo.findOne.mockResolvedValue(makeCoupon());
        bindingService.listByTemplate.mockResolvedValue([{ productId: 10, variantIds: [100] }]);
        const order: any = {
            customFields: { couponCode: 'C-TEST-0001' },
            lines: [line(10, 100, 100), line(20, 200, 50)],
        };

        const state = await couponAppliedCondition.check(ctx, order, [] as any, undefined as any);

        // 命中 base=100（仅绑定行）→ discountAmount=30；同时确认结算条件确实走了 binding 权威过滤
        expect(state).toEqual({ discountAmount: 30 });
        expect(bindingService.listByTemplate).toHaveBeenCalled();
    });

    it('订单全非绑定行 → check 返回 false', async () => {
        couponRepo.findOne.mockResolvedValue(makeCoupon());
        bindingService.listByTemplate.mockResolvedValue([{ productId: 10, variantIds: [100] }]);
        const order: any = {
            customFields: { couponCode: 'C-TEST-0002' },
            lines: [line(20, 200, 50)],
        };

        expect(await couponAppliedCondition.check(ctx, order, [] as any, undefined as any)).toBe(false);
    });

    it('binding 全部禁用（listByTemplate 空）→ 回退全店可用（历史行为）', async () => {
        couponRepo.findOne.mockResolvedValue(makeCoupon());
        bindingService.listByTemplate.mockResolvedValue([]);
        const order: any = {
            customFields: { couponCode: 'C-TEST-0003' },
            lines: [line(10, 100, 100), line(20, 200, 50)],
        };

        const state = await couponAppliedCondition.check(ctx, order, [] as any, undefined as any);

        // 全单 base=150，FIXED 30 封顶 → 30
        expect(state).toEqual({ discountAmount: 30 });
    });

    it('variantIds 为空数组 → 商品全 SKU 命中', async () => {
        couponRepo.findOne.mockResolvedValue(makeCoupon());
        bindingService.listByTemplate.mockResolvedValue([{ productId: 10, variantIds: [] }]);
        const order: any = {
            customFields: { couponCode: 'C-TEST-0004' },
            lines: [line(10, 200, 100)],
        };

        const state = await couponAppliedCondition.check(ctx, order, [] as any, undefined as any);

        expect(state).toEqual({ discountAmount: 30 });
    });

    it('多 variant 绑定 → 任一命中即纳入', async () => {
        couponRepo.findOne.mockResolvedValue(makeCoupon());
        bindingService.listByTemplate.mockResolvedValue([{ productId: 10, variantIds: [100, 101] }]);
        const order: any = {
            customFields: { couponCode: 'C-TEST-0005' },
            lines: [line(10, 101, 100), line(20, 200, 50)],
        };

        const state = await couponAppliedCondition.check(ctx, order, [] as any, undefined as any);

        // variant 101 命中 → 绑定行小计 100 → 30
        expect(state).toEqual({ discountAmount: 30 });
    });

    it('newCustomerOnly 且客户有历史订单 → check 返回 false', async () => {
        couponRepo.findOne.mockResolvedValue(makeCoupon({ template: { newCustomerOnly: true } }));
        bindingService.listByTemplate.mockResolvedValue([]);
        qb.getCount.mockResolvedValue(1);
        const order: any = {
            customFields: { couponCode: 'C-TEST-0006' },
            customer: { id: 5 },
            lines: [line(10, 100, 100)],
        };

        expect(await couponAppliedCondition.check(ctx, order, [] as any, undefined as any)).toBe(false);
    });

    it('validDays 生成的 expiredAt 已过 → check 返回 false', async () => {
        couponRepo.findOne.mockResolvedValue(
            makeCoupon({ expiredAt: new Date(Date.now() - 86400000) }),
        );
        bindingService.listByTemplate.mockResolvedValue([]);
        const order: any = {
            customFields: { couponCode: 'C-TEST-0007' },
            lines: [line(10, 100, 100)],
        };

        expect(await couponAppliedCondition.check(ctx, order, [] as any, undefined as any)).toBe(false);
    });
});
