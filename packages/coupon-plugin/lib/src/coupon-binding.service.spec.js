"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const coupon_binding_service_1 = require("./coupon-binding.service");
const coupon_template_entity_1 = require("./coupon-template.entity");
const product_coupon_binding_entity_1 = require("./product-coupon-binding.entity");
/**
 * CouponBindingService 纯单元测试：mock TransactionalConnection，
 * 仅验证业务规则（模板 scope 单向同步 / 去重 / 可见性过滤 / 启停），不落库。
 */
(0, vitest_1.describe)('CouponBindingService', () => {
    let bindingRepo;
    let templateRepo;
    let connection;
    let service;
    const ctx = { channel: { id: 1 } };
    (0, vitest_1.beforeEach)(() => {
        bindingRepo = {
            find: vitest_1.vi.fn(),
            findOne: vitest_1.vi.fn(),
            save: vitest_1.vi.fn(),
            count: vitest_1.vi.fn(),
            delete: vitest_1.vi.fn(),
        };
        templateRepo = {
            find: vitest_1.vi.fn(),
            findOne: vitest_1.vi.fn(),
            save: vitest_1.vi.fn(),
        };
        connection = {
            getRepository: vitest_1.vi.fn((_ctx, entity) => {
                if (entity === product_coupon_binding_entity_1.ProductCouponBinding)
                    return bindingRepo;
                if (entity === coupon_template_entity_1.CouponTemplate)
                    return templateRepo;
                throw new Error(`unknown entity: ${entity}`);
            }),
        };
        service = new coupon_binding_service_1.CouponBindingService(connection);
    });
    (0, vitest_1.it)('create 后单向同步模板 scope=SKU（单 variant 写 variantId）', async () => {
        // 无重复绑定；模板原为 ALL 范围
        bindingRepo.findOne.mockResolvedValue(undefined);
        bindingRepo.save.mockImplementation(async (b) => b);
        templateRepo.findOne.mockResolvedValue({ id: 1, scope: 'ALL', variantId: null });
        await service.create(ctx, { productId: 10, variantIds: [100], couponTemplateId: 1 });
        const savedTpl = templateRepo.save.mock.calls[0][0];
        (0, vitest_1.expect)(savedTpl.scope).toBe('SKU');
        (0, vitest_1.expect)(savedTpl.variantId).toBe(100);
    });
    (0, vitest_1.it)('多 variant 同步后 template.variantId 为 null', async () => {
        // 模板原已绑定单一 variantId: 999，绑定多规格商品后应清空（表示商品全 SKU）
        bindingRepo.findOne.mockResolvedValue(undefined);
        bindingRepo.save.mockImplementation(async (b) => b);
        templateRepo.findOne.mockResolvedValue({ id: 1, scope: 'SKU', variantId: 999 });
        await service.create(ctx, { productId: 10, variantIds: [1, 2], couponTemplateId: 1 });
        const savedTpl = templateRepo.save.mock.calls[0][0];
        (0, vitest_1.expect)(savedTpl.scope).toBe('SKU');
        (0, vitest_1.expect)(savedTpl.variantId).toBeNull();
    });
    (0, vitest_1.it)('重复绑券（同商品同模板）抛 UserInputError', async () => {
        bindingRepo.findOne.mockResolvedValue({ id: 99, productId: 10, couponTemplateId: 1 });
        await (0, vitest_1.expect)(service.create(ctx, { productId: 10, variantIds: [100], couponTemplateId: 1 })).rejects.toThrow('Binding already exists');
        // 去重命中后不应再写库
        (0, vitest_1.expect)(bindingRepo.save).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('listByProduct 只返回 enabled 且模板 claimable 且 channelId 匹配的绑定', async () => {
        bindingRepo.find.mockResolvedValue([
            { id: 1, enabled: false, channelId: 1, template: { enabled: true, claimable: true } },
            { id: 2, enabled: true, channelId: 1, template: { enabled: true, claimable: false } },
            { id: 3, enabled: true, channelId: 1, template: { enabled: true, claimable: true } },
        ]);
        const result = await service.listByProduct(ctx, 10);
        (0, vitest_1.expect)(result.map(b => b.id)).toEqual([3]);
    });
    (0, vitest_1.it)('toggleEnabled 翻转 enabled 并保存', async () => {
        bindingRepo.findOne.mockResolvedValue({ id: 5, enabled: true });
        bindingRepo.save.mockImplementation(async (b) => b);
        await service.toggleEnabled(ctx, 5);
        const saved = bindingRepo.save.mock.calls[0][0];
        (0, vitest_1.expect)(saved.enabled).toBe(false);
    });
});
//# sourceMappingURL=coupon-binding.service.spec.js.map