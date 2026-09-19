"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const core_1 = require("@vendure/core");
const coupon_promotion_condition_1 = require("./coupon-promotion-condition");
const coupon_runtime_1 = require("./coupon-runtime");
const coupon_settlement_1 = require("./coupon-settlement");
const customer_coupon_entity_1 = require("./customer-coupon.entity");
/**
 * couponAppliedCondition 结算校验单测：mock coupon-runtime 与 coupon-settlement 两个单例，
 * 验证 ①binding 集合限定命中商品行（唯一权威）②newCustomerOnly 拦截 ③validDays 过期判定。
 * 不落库；channel 用非默认商城，跳过 shopId 行过滤，聚焦 binding 逻辑。
 */
(0, vitest_1.describe)('couponAppliedCondition 结算校验', () => {
    let couponRepo;
    let customerRepo;
    let orderRepo;
    let connection;
    let bindingService;
    let qb;
    // 非默认商城（token/code 均不命中默认判据），跳过 shopId 行级过滤
    const ctx = {
        channel: { token: 'other-channel', code: 'other-channel', pricesIncludeTax: true },
        activeUserId: undefined,
    };
    /** 订单行：行形状对齐结算期 order.lines（productVariant.product.id 为商品 id） */
    const line = (productId, variantId, price) => ({
        productVariant: { id: variantId, product: { id: productId, customFields: {} } },
        linePrice: price,
        linePriceWithTax: price,
    });
    /** 券实例：默认 UNUSED / FIXED 30 / 无门槛，可覆盖（template 覆盖字段与原值合并） */
    const makeCoupon = (overrides) => {
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
        return Object.assign(Object.assign(Object.assign({}, base), overrides), { template: Object.assign(Object.assign({}, base.template), overrides === null || overrides === void 0 ? void 0 : overrides.template) });
    };
    (0, vitest_1.beforeEach)(() => {
        qb = {
            where: vitest_1.vi.fn().mockReturnThis(),
            andWhere: vitest_1.vi.fn().mockReturnThis(),
            getCount: vitest_1.vi.fn().mockResolvedValue(0),
        };
        couponRepo = { findOne: vitest_1.vi.fn() };
        customerRepo = { findOne: vitest_1.vi.fn() };
        orderRepo = { createQueryBuilder: vitest_1.vi.fn().mockReturnValue(qb) };
        connection = {
            getRepository: vitest_1.vi.fn((_ctx, entity) => {
                if (entity === customer_coupon_entity_1.CustomerCoupon)
                    return couponRepo;
                if (entity === core_1.Customer)
                    return customerRepo;
                if (entity === core_1.Order)
                    return orderRepo;
                throw new Error(`unknown entity: ${entity}`);
            }),
        };
        bindingService = { listByTemplate: vitest_1.vi.fn() };
        (0, coupon_runtime_1.setCouponConnection)(connection);
        (0, coupon_settlement_1.setBindingService)(bindingService);
    });
    (0, vitest_1.it)('订单含绑定行+非绑定行 → 只对绑定行算 base，FIXED 封顶命中行小计', async () => {
        // 券 FIXED discountValue=30；绑定行 product 10 linePrice 100，非绑定行 product 20 linePrice 50
        couponRepo.findOne.mockResolvedValue(makeCoupon());
        bindingService.listByTemplate.mockResolvedValue([{ productId: 10, variantIds: [100] }]);
        const order = {
            customFields: { couponCode: 'C-TEST-0001' },
            lines: [line(10, 100, 100), line(20, 200, 50)],
        };
        const state = await coupon_promotion_condition_1.couponAppliedCondition.check(ctx, order, [], undefined);
        // 命中 base=100（仅绑定行）→ discountAmount=30；同时确认结算条件确实走了 binding 权威过滤
        (0, vitest_1.expect)(state).toEqual({ discountAmount: 30 });
        (0, vitest_1.expect)(bindingService.listByTemplate).toHaveBeenCalled();
    });
    (0, vitest_1.it)('订单全非绑定行 → check 返回 false', async () => {
        couponRepo.findOne.mockResolvedValue(makeCoupon());
        bindingService.listByTemplate.mockResolvedValue([{ productId: 10, variantIds: [100] }]);
        const order = {
            customFields: { couponCode: 'C-TEST-0002' },
            lines: [line(20, 200, 50)],
        };
        (0, vitest_1.expect)(await coupon_promotion_condition_1.couponAppliedCondition.check(ctx, order, [], undefined)).toBe(false);
    });
    (0, vitest_1.it)('binding 全部禁用（listByTemplate 空）→ 回退全店可用（历史行为）', async () => {
        couponRepo.findOne.mockResolvedValue(makeCoupon());
        bindingService.listByTemplate.mockResolvedValue([]);
        const order = {
            customFields: { couponCode: 'C-TEST-0003' },
            lines: [line(10, 100, 100), line(20, 200, 50)],
        };
        const state = await coupon_promotion_condition_1.couponAppliedCondition.check(ctx, order, [], undefined);
        // 全单 base=150，FIXED 30 封顶 → 30
        (0, vitest_1.expect)(state).toEqual({ discountAmount: 30 });
    });
    (0, vitest_1.it)('variantIds 为空数组 → 商品全 SKU 命中', async () => {
        couponRepo.findOne.mockResolvedValue(makeCoupon());
        bindingService.listByTemplate.mockResolvedValue([{ productId: 10, variantIds: [] }]);
        const order = {
            customFields: { couponCode: 'C-TEST-0004' },
            lines: [line(10, 200, 100)],
        };
        const state = await coupon_promotion_condition_1.couponAppliedCondition.check(ctx, order, [], undefined);
        (0, vitest_1.expect)(state).toEqual({ discountAmount: 30 });
    });
    (0, vitest_1.it)('多 variant 绑定 → 任一命中即纳入', async () => {
        couponRepo.findOne.mockResolvedValue(makeCoupon());
        bindingService.listByTemplate.mockResolvedValue([{ productId: 10, variantIds: [100, 101] }]);
        const order = {
            customFields: { couponCode: 'C-TEST-0005' },
            lines: [line(10, 101, 100), line(20, 200, 50)],
        };
        const state = await coupon_promotion_condition_1.couponAppliedCondition.check(ctx, order, [], undefined);
        // variant 101 命中 → 绑定行小计 100 → 30
        (0, vitest_1.expect)(state).toEqual({ discountAmount: 30 });
    });
    (0, vitest_1.it)('newCustomerOnly 且客户有历史订单 → check 返回 false', async () => {
        couponRepo.findOne.mockResolvedValue(makeCoupon({ template: { newCustomerOnly: true } }));
        bindingService.listByTemplate.mockResolvedValue([]);
        qb.getCount.mockResolvedValue(1);
        const order = {
            customFields: { couponCode: 'C-TEST-0006' },
            customer: { id: 5 },
            lines: [line(10, 100, 100)],
        };
        (0, vitest_1.expect)(await coupon_promotion_condition_1.couponAppliedCondition.check(ctx, order, [], undefined)).toBe(false);
    });
    (0, vitest_1.it)('validDays 生成的 expiredAt 已过 → check 返回 false', async () => {
        couponRepo.findOne.mockResolvedValue(makeCoupon({ expiredAt: new Date(Date.now() - 86400000) }));
        bindingService.listByTemplate.mockResolvedValue([]);
        const order = {
            customFields: { couponCode: 'C-TEST-0007' },
            lines: [line(10, 100, 100)],
        };
        (0, vitest_1.expect)(await coupon_promotion_condition_1.couponAppliedCondition.check(ctx, order, [], undefined)).toBe(false);
    });
});
//# sourceMappingURL=coupon-promotion-condition.spec.js.map