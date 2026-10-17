import { describe, expect, it, vi } from 'vitest';

import { expandBundleItems, filterSaleCatalogue, isSaleOrderRefundable } from './coupon-sale';
import { CouponService } from './coupon.service';
import { CouponSaleService } from './coupon-sale.service';
import { CouponTemplate } from './coupon-template.entity';
import { CouponBundle } from './coupon-bundle.entity';

describe('isSaleOrderRefundable', () => {
    it('全部未使用 → 可退', () => {
        expect(isSaleOrderRefundable(['UNUSED', 'UNUSED'])).toBe(true);
    });

    it('过期券视为未使用 → 可退', () => {
        expect(isSaleOrderRefundable(['UNUSED', 'EXPIRED'])).toBe(true);
    });

    it('回退券（RETURNED）视为未使用 → 可退', () => {
        expect(isSaleOrderRefundable(['RETURNED'])).toBe(true);
    });

    it('存在一张 USED → 不可退', () => {
        expect(isSaleOrderRefundable(['UNUSED', 'USED', 'EXPIRED'])).toBe(false);
    });

    it('空数组（无券可回收）→ 不可退', () => {
        expect(isSaleOrderRefundable([])).toBe(false);
    });

    it('null/undefined 状态按未使用处理', () => {
        expect(isSaleOrderRefundable([null, undefined])).toBe(true);
    });
});

describe('expandBundleItems', () => {
    it('quantity 缺省按 1 张展开', () => {
        expect(expandBundleItems([{ templateId: 7 }, { templateId: 9 }])).toEqual([7, 9]);
    });

    it('quantity 为 3 时重复 3 次', () => {
        expect(expandBundleItems([{ templateId: 7, quantity: 3 }])).toEqual([7, 7, 7]);
    });

    it('quantity 为 0/负数/小数时下限为 1 并取整', () => {
        expect(expandBundleItems([{ templateId: 1, quantity: 0 }])).toEqual([1]);
        expect(expandBundleItems([{ templateId: 1, quantity: -5 }])).toEqual([1]);
        expect(expandBundleItems([{ templateId: 1, quantity: 2.9 }])).toEqual([1, 1]);
    });

    it('空列表返回空数组', () => {
        expect(expandBundleItems([])).toEqual([]);
    });
});

describe('filterSaleCatalogue', () => {
    it('仅保留 salePrice > 0 的模板', () => {
        const list = [
            { id: 1, salePrice: 990 },
            { id: 2, salePrice: 0 },
            { id: 3, salePrice: null },
            { id: 4, salePrice: 100 },
        ];
        expect(filterSaleCatalogue(list).map(t => t.id)).toEqual([1, 4]);
    });
});

/**
 * saleCatalogue 渠道隔离：mock TransactionalConnection（不落库），
 * 别家店的券（distributionChannels 含 SALE 但 channels 不含当前渠道）不得进入本店目录；
 * 本店券与 channels 为空的平台券正常可见——与 loadSaleableTemplate 购买校验同口径。
 */
describe('CouponSaleService.saleCatalogue 渠道隔离', () => {
    const ctx: any = { channel: { id: 37 }, channelId: 37 };

    function makeService(allTemplates: any[]) {
        const templateRepo = { find: vi.fn().mockResolvedValue(allTemplates) };
        const bundleRepo = { find: vi.fn().mockResolvedValue([]) };
        const connection = {
            getRepository: vi.fn((_c: any, entity: any) => {
                if (entity === CouponTemplate) return templateRepo;
                if (entity === CouponBundle) return bundleRepo;
                throw new Error(`unknown entity: ${entity}`);
            }),
        };
        const couponService = new CouponService({} as any, {} as any, {} as any);
        return new CouponSaleService(connection as any, couponService, {} as any);
    }

    const tpl = (over: Record<string, any>) =>
        ({ enabled: true, salePrice: 990, distributionChannels: 'SALE', ...over }) as any;

    it('跨渠道券（channels=[1]，ctx=37）不进目录', async () => {
        const svc = makeService([
            tpl({ id: 1, channels: [{ id: 37 }] }), // 本店券 → 可见
            tpl({ id: 2, channels: [{ id: 1 }] }), // 别家店券 → 隐藏
        ]);
        const { templates } = await svc.saleCatalogue(ctx);
        expect(templates.map(t => t.id)).toEqual([1]);
    });

    it('channels 为空的平台券不限渠道 → 仍可见', async () => {
        const svc = makeService([tpl({ id: 3, channels: [] })]);
        const { templates } = await svc.saleCatalogue(ctx);
        expect(templates.map(t => t.id)).toEqual([3]);
    });

    it('禁用 / 无售价的券照旧过滤', async () => {
        const svc = makeService([
            tpl({ id: 4, enabled: false, channels: [{ id: 37 }] }),
            tpl({ id: 5, salePrice: 0, channels: [{ id: 37 }] }),
        ]);
        const { templates } = await svc.saleCatalogue(ctx);
        expect(templates).toEqual([]);
    });
});