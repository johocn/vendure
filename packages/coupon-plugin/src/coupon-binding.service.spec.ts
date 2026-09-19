import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CouponBindingService } from './coupon-binding.service';
import { CouponTemplate } from './coupon-template.entity';
import { ProductCouponBinding } from './product-coupon-binding.entity';

/**
 * CouponBindingService 纯单元测试：mock TransactionalConnection，
 * 仅验证业务规则（模板 scope 单向同步 / 去重 / 可见性过滤 / 启停），不落库。
 */
describe('CouponBindingService', () => {
    let bindingRepo: any;
    let templateRepo: any;
    let connection: any;
    let service: CouponBindingService;
    const ctx: any = { channel: { id: 1 } };

    beforeEach(() => {
        bindingRepo = {
            find: vi.fn(),
            findOne: vi.fn(),
            save: vi.fn(),
            count: vi.fn(),
            delete: vi.fn(),
        };
        templateRepo = {
            find: vi.fn(),
            findOne: vi.fn(),
            save: vi.fn(),
        };
        connection = {
            getRepository: vi.fn((_ctx: any, entity: any) => {
                if (entity === ProductCouponBinding) return bindingRepo;
                if (entity === CouponTemplate) return templateRepo;
                throw new Error(`unknown entity: ${entity}`);
            }),
        };
        service = new CouponBindingService(connection as any);
    });

    it('create 后单向同步模板 scope=SKU（单 variant 写 variantId）', async () => {
        // 无重复绑定；模板原为 ALL 范围
        bindingRepo.findOne.mockResolvedValue(undefined);
        bindingRepo.save.mockImplementation(async (b: any) => b);
        templateRepo.findOne.mockResolvedValue({ id: 1, scope: 'ALL', variantId: null });

        await service.create(ctx, { productId: 10, variantIds: [100], couponTemplateId: 1 });

        const savedTpl = templateRepo.save.mock.calls[0][0];
        expect(savedTpl.scope).toBe('SKU');
        expect(savedTpl.variantId).toBe(100);
    });

    it('多 variant 同步后 template.variantId 为 null', async () => {
        // 模板原已绑定单一 variantId: 999，绑定多规格商品后应清空（表示商品全 SKU）
        bindingRepo.findOne.mockResolvedValue(undefined);
        bindingRepo.save.mockImplementation(async (b: any) => b);
        templateRepo.findOne.mockResolvedValue({ id: 1, scope: 'SKU', variantId: 999 });

        await service.create(ctx, { productId: 10, variantIds: [1, 2], couponTemplateId: 1 });

        const savedTpl = templateRepo.save.mock.calls[0][0];
        expect(savedTpl.scope).toBe('SKU');
        expect(savedTpl.variantId).toBeNull();
    });

    it('重复绑券（同商品同模板）抛 UserInputError', async () => {
        bindingRepo.findOne.mockResolvedValue({ id: 99, productId: 10, couponTemplateId: 1 });

        await expect(
            service.create(ctx, { productId: 10, variantIds: [100], couponTemplateId: 1 }),
        ).rejects.toThrow('Binding already exists');
        // 去重命中后不应再写库
        expect(bindingRepo.save).not.toHaveBeenCalled();
    });

    it('listByProduct 只返回 enabled 且模板 claimable 且 channelId 匹配的绑定', async () => {
        bindingRepo.find.mockResolvedValue([
            { id: 1, enabled: false, channelId: 1, template: { enabled: true, claimable: true } },
            { id: 2, enabled: true, channelId: 1, template: { enabled: true, claimable: false } },
            { id: 3, enabled: true, channelId: 1, template: { enabled: true, claimable: true } },
        ]);

        const result = await service.listByProduct(ctx, 10);

        expect(result.map(b => (b as any).id)).toEqual([3]);
    });

    it('toggleEnabled 翻转 enabled 并保存', async () => {
        bindingRepo.findOne.mockResolvedValue({ id: 5, enabled: true });
        bindingRepo.save.mockImplementation(async (b: any) => b);

        await service.toggleEnabled(ctx, 5);

        const saved = bindingRepo.save.mock.calls[0][0];
        expect(saved.enabled).toBe(false);
    });

    it('删除最后一个 enabled binding 后：模板 variantId 清空、scope 保持 SKU', async () => {
        // 删除前先 findOne 取到绑定所属模板 id
        bindingRepo.findOne.mockResolvedValue({ id: 1, couponTemplateId: 7, enabled: true });
        bindingRepo.count.mockResolvedValue(0); // 该模板下已无剩余启用绑定
        templateRepo.findOne.mockResolvedValue({ id: 7, scope: 'SKU', variantId: 999 });

        await service.delete(ctx, 1);

        expect(bindingRepo.delete).toHaveBeenCalledWith(1);
        expect(bindingRepo.count).toHaveBeenCalledWith({
            where: { couponTemplateId: 7, enabled: true },
        });
        const savedTpl = templateRepo.save.mock.calls[0][0];
        expect(savedTpl.variantId).toBeNull();
        expect(savedTpl.scope).toBe('SKU'); // scope 保持，不回退 ALL
    });

    it('toggleEnabled 关掉其中一个，另一 binding 仍 enabled：模板不动', async () => {
        bindingRepo.findOne.mockResolvedValue({ id: 5, enabled: true, couponTemplateId: 7 });
        bindingRepo.save.mockImplementation(async (b: any) => b);
        bindingRepo.count.mockResolvedValue(1); // 仍有其他启用绑定
        templateRepo.findOne.mockResolvedValue({ id: 7, scope: 'SKU', variantId: 999 });

        await service.toggleEnabled(ctx, 5);

        const saved = bindingRepo.save.mock.calls[0][0];
        expect(saved.enabled).toBe(false);
        // 还有启用绑定 → 不加回退，模板不入库
        expect(bindingRepo.count).toHaveBeenCalled();
        expect(templateRepo.save).not.toHaveBeenCalled();
    });

    it('全部 enabled binding 关闭：variantId 清空、scope 保持', async () => {
        bindingRepo.findOne.mockResolvedValue({ id: 5, enabled: true, couponTemplateId: 7 });
        bindingRepo.save.mockImplementation(async (b: any) => b);
        bindingRepo.count.mockResolvedValue(0); // 已无剩余启用绑定
        templateRepo.findOne.mockResolvedValue({ id: 7, scope: 'SKU', variantId: 999 });

        await service.toggleEnabled(ctx, 5);

        const savedTpl = templateRepo.save.mock.calls[0][0];
        expect(savedTpl.variantId).toBeNull();
        expect(savedTpl.scope).toBe('SKU');
    });
});
