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
        // 清理模块级共享缓存，避免跨用例串状态
        coupon_binding_service_1.couponBindingCache.clear();
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
    (0, vitest_1.it)('删除最后一个 enabled binding 后：模板 variantId 清空、scope 保持 SKU', async () => {
        // 删除前先 findOne 取到绑定所属模板 id
        bindingRepo.findOne.mockResolvedValue({ id: 1, couponTemplateId: 7, enabled: true });
        bindingRepo.count.mockResolvedValue(0); // 该模板下已无剩余启用绑定
        templateRepo.findOne.mockResolvedValue({ id: 7, scope: 'SKU', variantId: 999 });
        await service.delete(ctx, 1);
        (0, vitest_1.expect)(bindingRepo.delete).toHaveBeenCalledWith(1);
        (0, vitest_1.expect)(bindingRepo.count).toHaveBeenCalledWith({
            where: { couponTemplateId: 7, enabled: true },
        });
        const savedTpl = templateRepo.save.mock.calls[0][0];
        (0, vitest_1.expect)(savedTpl.variantId).toBeNull();
        (0, vitest_1.expect)(savedTpl.scope).toBe('SKU'); // scope 保持，不回退 ALL
    });
    (0, vitest_1.it)('toggleEnabled 关掉其中一个，另一 binding 仍 enabled：模板不动', async () => {
        bindingRepo.findOne.mockResolvedValue({ id: 5, enabled: true, couponTemplateId: 7 });
        bindingRepo.save.mockImplementation(async (b) => b);
        bindingRepo.count.mockResolvedValue(1); // 仍有其他启用绑定
        templateRepo.findOne.mockResolvedValue({ id: 7, scope: 'SKU', variantId: 999 });
        await service.toggleEnabled(ctx, 5);
        const saved = bindingRepo.save.mock.calls[0][0];
        (0, vitest_1.expect)(saved.enabled).toBe(false);
        // 还有启用绑定 → 不加回退，模板不入库
        (0, vitest_1.expect)(bindingRepo.count).toHaveBeenCalled();
        (0, vitest_1.expect)(templateRepo.save).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('全部 enabled binding 关闭：variantId 清空、scope 保持', async () => {
        bindingRepo.findOne.mockResolvedValue({ id: 5, enabled: true, couponTemplateId: 7 });
        bindingRepo.save.mockImplementation(async (b) => b);
        bindingRepo.count.mockResolvedValue(0); // 已无剩余启用绑定
        templateRepo.findOne.mockResolvedValue({ id: 7, scope: 'SKU', variantId: 999 });
        await service.toggleEnabled(ctx, 5);
        const savedTpl = templateRepo.save.mock.calls[0][0];
        (0, vitest_1.expect)(savedTpl.variantId).toBeNull();
        (0, vitest_1.expect)(savedTpl.scope).toBe('SKU');
    });
    (0, vitest_1.it)('listByTemplate 走缓存：同 ctx/templateId 重复调用底层 repo.find 仅一次', async () => {
        bindingRepo.find.mockResolvedValue([
            { id: 3, enabled: true, channelId: 1, template: { enabled: true, claimable: true } },
        ]);
        const r1 = await service.listByTemplate(ctx, 42);
        const r2 = await service.listByTemplate(ctx, 42);
        const r3 = await service.listByTemplate(ctx, 42);
        (0, vitest_1.expect)(bindingRepo.find).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(r1.map((b) => b.id)).toEqual([3]);
        (0, vitest_1.expect)(r2.map((b) => b.id)).toEqual([3]);
        (0, vitest_1.expect)(r3.map((b) => b.id)).toEqual([3]);
    });
    (0, vitest_1.it)('listByTemplate 命中缓存后，CRUD 主动失效使缓存重算', async () => {
        bindingRepo.find.mockResolvedValue([
            { id: 3, enabled: true, channelId: 1, template: { enabled: true, claimable: true } },
        ]);
        await service.listByTemplate(ctx, 42); // 首次结果入缓存
        // 触发一次 create（同模板），应失效对应 key
        bindingRepo.findOne.mockResolvedValue(undefined);
        bindingRepo.save.mockImplementation(async (b) => b);
        templateRepo.findOne.mockResolvedValue({ id: 42, scope: 'ALL', variantId: null });
        await service.create(ctx, { productId: 11, variantIds: [1], couponTemplateId: 42 });
        const r = await service.listByTemplate(ctx, 42);
        (0, vitest_1.expect)(bindingRepo.find).toHaveBeenCalledTimes(2); // 失效后重新查库一次
        (0, vitest_1.expect)(r.map((b) => b.id)).toEqual([3]);
    });
});
//# sourceMappingURL=coupon-binding.service.spec.js.map