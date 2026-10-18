import { describe, expect, it, vi } from 'vitest';

import { expandBundleItems, filterSaleCatalogue, isSaleOrderRefundable } from './coupon-sale';
import { CouponService } from './coupon.service';
import { CouponSaleService } from './coupon-sale.service';
import { CouponTemplate } from './coupon-template.entity';
import { CouponBundle } from './coupon-bundle.entity';
import { CouponSaleOrder } from './coupon-sale-order.entity';
import { Channel, Customer } from '@vendure/core';
import { resolvePromoPrice } from './coupon-sale';

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
describe('resolvePromoPrice 到手价重算', () => {
    it('首购立减：¥5 券立减 ¥2 → ¥3 + FIRST_BUY', () => {
        expect(resolvePromoPrice(500, { studentApproved: false, firstBuyEligible: true, firstBuyDiscount: 200 })).toEqual({
            final: 300,
            discountType: 'FIRST_BUY',
            discountAmount: 200,
        });
    });
    it('学生价：认证学生 ¥3 → ¥3 + STUDENT（首购不叠加）', () => {
        expect(resolvePromoPrice(500, { studentPrice: 300, studentApproved: true, firstBuyEligible: true, firstBuyDiscount: 200 })).toEqual({
            final: 300,
            discountType: 'STUDENT',
            discountAmount: 200,
        });
    });
    it('学生价低于首购价时取学生价', () => {
        expect(resolvePromoPrice(500, { studentPrice: 100, studentApproved: true, firstBuyEligible: true, firstBuyDiscount: 200 }).final).toBe(100);
    });
    it('学生价高于首购价时取首购立减', () => {
        expect(resolvePromoPrice(500, { studentPrice: 450, studentApproved: true, firstBuyEligible: true, firstBuyDiscount: 200 }).discountType).toBe('FIRST_BUY');
    });
    it('未认证学生不享学生价；老客原价', () => {
        expect(resolvePromoPrice(500, { studentPrice: 100, studentApproved: false, firstBuyEligible: false, firstBuyDiscount: 200 })).toEqual({
            final: 500,
            discountType: null,
            discountAmount: 0,
        });
    });
    it('立减超过原价按 1 分兜底；学生价 0/缺省不生效', () => {
        expect(resolvePromoPrice(100, { studentApproved: false, firstBuyEligible: true, firstBuyDiscount: 9999 }).final).toBe(1);
        expect(resolvePromoPrice(500, { studentPrice: 0, studentApproved: true, firstBuyEligible: false, firstBuyDiscount: 0 }).final).toBe(500);
    });
});

describe('CouponSaleService.saleCatalogue 渠道隔离', () => {
    const ctx: any = { channel: { id: 37 }, channelId: 37 };

    function makeService(allTemplates: any[], opts?: { tplRows?: any[]; bundleRows?: any[]; bundles?: any[]; channel?: any; customer?: any }) {
        const templateRepo = { find: vi.fn().mockResolvedValue(allTemplates) };
        const bundleRepo = { find: vi.fn().mockResolvedValue(opts?.bundles ?? []) };
        const saleOrderRepo = {
            createQueryBuilder: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnThis(),
                addSelect: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                groupBy: vi.fn().mockReturnThis(),
                // 首次调用 → 单券聚合行；第二次 → 券包聚合行
                getRawMany: vi
                    .fn()
                    .mockResolvedValueOnce(opts?.tplRows ?? [])
                    .mockResolvedValueOnce(opts?.bundleRows ?? []),
                getCount: vi.fn().mockResolvedValue(0),
            }),
        };
        const channelRepo = { findOne: vi.fn().mockResolvedValue(opts?.channel ?? { customFields: {} }) };
        const customerRepo = { findOne: vi.fn().mockResolvedValue(opts?.customer ?? null) };
        const connection = {
            getRepository: vi.fn((_c: any, entity: any) => {
                if (entity === CouponTemplate) return templateRepo;
                if (entity === CouponBundle) return bundleRepo;
                if (entity === CouponSaleOrder) return saleOrderRepo;
                if (entity === Channel) return channelRepo;
                if (entity === Customer) return customerRepo;
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

    it('已售数聚合：PAID 出售单按 templateId/bundleId 计数，无成交为 0', async () => {
        const bundle = { id: 9, enabled: true, channelId: 37, salePrice: 880 } as any;
        const svc = makeService([tpl({ id: 1, channels: [{ id: 37 }] }), tpl({ id: 2, channels: [{ id: 37 }] })], {
            tplRows: [
                { templateId: '1', cnt: '12' }, // postgres raw 计数为字符串
            ],
            bundleRows: [{ bundleId: '9', cnt: '3' }],
            bundles: [bundle],
        });
        const { templates, bundles } = await svc.saleCatalogue(ctx);
        expect((templates.find(t => t.id === 1) as any).soldCount).toBe(12);
        expect((templates.find(t => t.id === 2) as any).soldCount).toBe(0);
        expect((bundles[0] as any).soldCount).toBe(3);
    });
});