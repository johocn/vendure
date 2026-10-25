import { describe, expect, it, vi } from 'vitest';

import { expandBundleItems, filterSaleCatalogue, isSaleOrderRefundable } from './coupon-sale';
import { localizeCampaignText, parseCouponCampaignConfig, resolveActiveCampaign } from './coupon-sale';
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
        const settlementService = { onSaleOrderRefunded: vi.fn().mockResolvedValue({ cancelled: 0, reversed: 0, failed: 0 }) };
        return new CouponSaleService(
            connection as any,
            couponService,
            {} as any,
            settlementService as any,
            { findOne: vi.fn() } as any,
        );
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

    it('活动位：窗口内 + 关联券命中本店目录 → campaign 下发（他店券被过滤）', async () => {
        const nowMs = Date.now();
        const cfg = JSON.stringify({
            enabled: true,
            name: { zh: '周末限时特惠', en: 'Weekend Flash Sale' },
            startsAt: new Date(nowMs - 3600e3).toISOString(), // 1 小时前开始
            endsAt: new Date(nowMs + 3600e3).toISOString(), // 1 小时后结束
            templateIds: [1, 2],
        });
        const svc = makeService([tpl({ id: 1, channels: [{ id: 37 }] }), tpl({ id: 2, channels: [{ id: 1 }] })], {
            channel: { customFields: { couponCampaign: cfg } },
        });
        const { campaign } = await svc.saleCatalogue({ ...ctx, languageCode: 'zh_Hans' });
        expect(campaign).not.toBeNull();
        expect(campaign!.name).toBe('周末限时特惠');
        expect(campaign!.templates.map(t => t.id)).toEqual([1]);
        expect(campaign!.endsAt).toBe(new Date(nowMs + 3600e3).toISOString());
    });

    it('活动位：窗口外 / 未配置 / 禁用 → campaign 为 null', async () => {
        const past = JSON.stringify({ name: '旧活动', endsAt: '2020-01-01T00:00:00Z', templateIds: [1] });
        expect(
            (await makeService([tpl({ id: 1, channels: [{ id: 37 }] })], { channel: { customFields: { couponCampaign: past } } }).saleCatalogue(ctx)).campaign,
        ).toBeNull();
        expect(
            (await makeService([tpl({ id: 1, channels: [{ id: 37 }] })], { channel: { customFields: {} } }).saleCatalogue(ctx)).campaign,
        ).toBeNull();
        const notStarted = JSON.stringify({ name: '预告', startsAt: '2031-01-01T00:00:00Z', endsAt: '2031-01-02T00:00:00Z', templateIds: [1] });
        expect(
            (await makeService([tpl({ id: 1, channels: [{ id: 37 }] })], { channel: { customFields: { couponCampaign: notStarted } } }).saleCatalogue(ctx)).campaign,
        ).toBeNull();
        const off = JSON.stringify({ name: 'x', endsAt: '2030-01-01T00:00:00Z', templateIds: [1], enabled: false });
        expect(
            (await makeService([tpl({ id: 1, channels: [{ id: 37 }] })], { channel: { customFields: { couponCampaign: off } } }).saleCatalogue(ctx)).campaign,
        ).toBeNull();
    });
});

describe('倒计时活动位纯函数', () => {
    const saleable = [{ id: 83 }, { id: 84 }, { id: 90 }];

    it('parseCouponCampaignConfig：坏 JSON / 非对象 / 空值 → null；字段规整', () => {
        expect(parseCouponCampaignConfig(null)).toBeNull();
        expect(parseCouponCampaignConfig('')).toBeNull();
        expect(parseCouponCampaignConfig('not-json')).toBeNull();
        expect(parseCouponCampaignConfig('[1,2]')).toBeNull();
        const cfg = parseCouponCampaignConfig('{"enabled":false,"name":{"zh":"x"},"endsAt":"2026-10-26T20:00:00+08:00","templateIds":["83","84",-1]}');
        expect(cfg).toEqual({
            enabled: false,
            name: { zh: 'x' },
            subtitle: null,
            rules: null,
            startsAt: null,
            endsAt: '2026-10-26T12:00:00.000Z',
            templateIds: [83, 84],
            newCustomerOnly: false,
        });
    });

    it('parseCouponCampaignConfig：newCustomerOnly 解析（FR-D 新客 1 元购位）', () => {
        const cfg = parseCouponCampaignConfig(
            '{"enabled":true,"name":"新人1元购","endsAt":"2026-10-26T20:00:00+08:00","templateIds":[83],"newCustomerOnly":true}',
        );
        expect(cfg?.newCustomerOnly).toBe(true);
        expect(parseCouponCampaignConfig('{"enabled":true,"endsAt":"2026-10-26T12:00:00Z","templateIds":[83]}')?.newCustomerOnly).toBe(false);
    });

    it('resolveActiveCampaign：时间窗判定 + 配置顺序 + 命中过滤', () => {
        const cfg = { enabled: true, name: '闪购', startsAt: null, endsAt: '2026-10-26T12:00:00Z', templateIds: [90, 84, 999] };
        const view = resolveActiveCampaign(cfg, saleable, new Date('2026-10-24T00:00:00Z'), 'zh_Hans');
        expect(view!.templates.map(t => t.id)).toEqual([90, 84]);
        expect(view!.endsAt).toBe('2026-10-26T12:00:00.000Z');
        // 未开始
        expect(resolveActiveCampaign({ ...cfg, startsAt: '2026-12-01T00:00:00Z' }, saleable, new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
        // 已结束 / 缺 endsAt
        expect(resolveActiveCampaign(cfg, saleable, new Date('2026-10-27T00:00:00Z'), 'zh_Hans')).toBeNull();
        expect(resolveActiveCampaign({ ...cfg, endsAt: null }, saleable, new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
        // 命中券为空 / 未配置 templateIds
        expect(resolveActiveCampaign({ ...cfg, templateIds: [999] }, saleable, new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
        expect(resolveActiveCampaign({ ...cfg, templateIds: [] }, saleable, new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
        // 无 name → null（活动位无标题不展示）
        expect(resolveActiveCampaign({ enabled: true, name: null, endsAt: '2030-01-01T00:00:00Z', templateIds: [83] }, saleable, new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
    });

    it('localizeCampaignText：lang 精确 → 去地区码 → 首个非空', () => {
        const v = { zh: '周末特惠', en: 'Weekend Sale' };
        expect(localizeCampaignText(v, 'zh_Hans')).toBe('周末特惠');
        expect(localizeCampaignText(v, 'en')).toBe('Weekend Sale');
        expect(localizeCampaignText({ zh: '仅中文' }, 'en')).toBe('仅中文');
        expect(localizeCampaignText('纯字符串', 'zh_Hans')).toBe('纯字符串');
        expect(localizeCampaignText({ zh: '  ' }, 'zh_Hans')).toBeNull();
        expect(localizeCampaignText(null, 'zh_Hans')).toBeNull();
    });
});