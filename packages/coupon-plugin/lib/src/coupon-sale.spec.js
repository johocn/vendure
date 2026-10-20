"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const coupon_sale_1 = require("./coupon-sale");
const coupon_sale_2 = require("./coupon-sale");
const coupon_service_1 = require("./coupon.service");
const coupon_sale_service_1 = require("./coupon-sale.service");
const coupon_template_entity_1 = require("./coupon-template.entity");
const coupon_bundle_entity_1 = require("./coupon-bundle.entity");
const coupon_sale_order_entity_1 = require("./coupon-sale-order.entity");
const core_1 = require("@vendure/core");
const coupon_sale_3 = require("./coupon-sale");
(0, vitest_1.describe)('isSaleOrderRefundable', () => {
    (0, vitest_1.it)('全部未使用 → 可退', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.isSaleOrderRefundable)(['UNUSED', 'UNUSED'])).toBe(true);
    });
    (0, vitest_1.it)('过期券视为未使用 → 可退', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.isSaleOrderRefundable)(['UNUSED', 'EXPIRED'])).toBe(true);
    });
    (0, vitest_1.it)('回退券（RETURNED）视为未使用 → 可退', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.isSaleOrderRefundable)(['RETURNED'])).toBe(true);
    });
    (0, vitest_1.it)('存在一张 USED → 不可退', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.isSaleOrderRefundable)(['UNUSED', 'USED', 'EXPIRED'])).toBe(false);
    });
    (0, vitest_1.it)('空数组（无券可回收）→ 不可退', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.isSaleOrderRefundable)([])).toBe(false);
    });
    (0, vitest_1.it)('null/undefined 状态按未使用处理', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.isSaleOrderRefundable)([null, undefined])).toBe(true);
    });
});
(0, vitest_1.describe)('expandBundleItems', () => {
    (0, vitest_1.it)('quantity 缺省按 1 张展开', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.expandBundleItems)([{ templateId: 7 }, { templateId: 9 }])).toEqual([7, 9]);
    });
    (0, vitest_1.it)('quantity 为 3 时重复 3 次', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.expandBundleItems)([{ templateId: 7, quantity: 3 }])).toEqual([7, 7, 7]);
    });
    (0, vitest_1.it)('quantity 为 0/负数/小数时下限为 1 并取整', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.expandBundleItems)([{ templateId: 1, quantity: 0 }])).toEqual([1]);
        (0, vitest_1.expect)((0, coupon_sale_1.expandBundleItems)([{ templateId: 1, quantity: -5 }])).toEqual([1]);
        (0, vitest_1.expect)((0, coupon_sale_1.expandBundleItems)([{ templateId: 1, quantity: 2.9 }])).toEqual([1, 1]);
    });
    (0, vitest_1.it)('空列表返回空数组', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.expandBundleItems)([])).toEqual([]);
    });
});
(0, vitest_1.describe)('filterSaleCatalogue', () => {
    (0, vitest_1.it)('仅保留 salePrice > 0 的模板', () => {
        const list = [
            { id: 1, salePrice: 990 },
            { id: 2, salePrice: 0 },
            { id: 3, salePrice: null },
            { id: 4, salePrice: 100 },
        ];
        (0, vitest_1.expect)((0, coupon_sale_1.filterSaleCatalogue)(list).map(t => t.id)).toEqual([1, 4]);
    });
});
/**
 * saleCatalogue 渠道隔离：mock TransactionalConnection（不落库），
 * 别家店的券（distributionChannels 含 SALE 但 channels 不含当前渠道）不得进入本店目录；
 * 本店券与 channels 为空的平台券正常可见——与 loadSaleableTemplate 购买校验同口径。
 */
(0, vitest_1.describe)('resolvePromoPrice 到手价重算', () => {
    (0, vitest_1.it)('首购立减：¥5 券立减 ¥2 → ¥3 + FIRST_BUY', () => {
        (0, vitest_1.expect)((0, coupon_sale_3.resolvePromoPrice)(500, { studentApproved: false, firstBuyEligible: true, firstBuyDiscount: 200 })).toEqual({
            final: 300,
            discountType: 'FIRST_BUY',
            discountAmount: 200,
        });
    });
    (0, vitest_1.it)('学生价：认证学生 ¥3 → ¥3 + STUDENT（首购不叠加）', () => {
        (0, vitest_1.expect)((0, coupon_sale_3.resolvePromoPrice)(500, { studentPrice: 300, studentApproved: true, firstBuyEligible: true, firstBuyDiscount: 200 })).toEqual({
            final: 300,
            discountType: 'STUDENT',
            discountAmount: 200,
        });
    });
    (0, vitest_1.it)('学生价低于首购价时取学生价', () => {
        (0, vitest_1.expect)((0, coupon_sale_3.resolvePromoPrice)(500, { studentPrice: 100, studentApproved: true, firstBuyEligible: true, firstBuyDiscount: 200 }).final).toBe(100);
    });
    (0, vitest_1.it)('学生价高于首购价时取首购立减', () => {
        (0, vitest_1.expect)((0, coupon_sale_3.resolvePromoPrice)(500, { studentPrice: 450, studentApproved: true, firstBuyEligible: true, firstBuyDiscount: 200 }).discountType).toBe('FIRST_BUY');
    });
    (0, vitest_1.it)('未认证学生不享学生价；老客原价', () => {
        (0, vitest_1.expect)((0, coupon_sale_3.resolvePromoPrice)(500, { studentPrice: 100, studentApproved: false, firstBuyEligible: false, firstBuyDiscount: 200 })).toEqual({
            final: 500,
            discountType: null,
            discountAmount: 0,
        });
    });
    (0, vitest_1.it)('立减超过原价按 1 分兜底；学生价 0/缺省不生效', () => {
        (0, vitest_1.expect)((0, coupon_sale_3.resolvePromoPrice)(100, { studentApproved: false, firstBuyEligible: true, firstBuyDiscount: 9999 }).final).toBe(1);
        (0, vitest_1.expect)((0, coupon_sale_3.resolvePromoPrice)(500, { studentPrice: 0, studentApproved: true, firstBuyEligible: false, firstBuyDiscount: 0 }).final).toBe(500);
    });
});
(0, vitest_1.describe)('CouponSaleService.saleCatalogue 渠道隔离', () => {
    const ctx = { channel: { id: 37 }, channelId: 37 };
    function makeService(allTemplates, opts) {
        var _a, _b, _d, _e, _f;
        const templateRepo = { find: vitest_1.vi.fn().mockResolvedValue(allTemplates) };
        const bundleRepo = { find: vitest_1.vi.fn().mockResolvedValue((_a = opts === null || opts === void 0 ? void 0 : opts.bundles) !== null && _a !== void 0 ? _a : []) };
        const saleOrderRepo = {
            createQueryBuilder: vitest_1.vi.fn().mockReturnValue({
                select: vitest_1.vi.fn().mockReturnThis(),
                addSelect: vitest_1.vi.fn().mockReturnThis(),
                where: vitest_1.vi.fn().mockReturnThis(),
                groupBy: vitest_1.vi.fn().mockReturnThis(),
                // 首次调用 → 单券聚合行；第二次 → 券包聚合行
                getRawMany: vitest_1.vi
                    .fn()
                    .mockResolvedValueOnce((_b = opts === null || opts === void 0 ? void 0 : opts.tplRows) !== null && _b !== void 0 ? _b : [])
                    .mockResolvedValueOnce((_d = opts === null || opts === void 0 ? void 0 : opts.bundleRows) !== null && _d !== void 0 ? _d : []),
                getCount: vitest_1.vi.fn().mockResolvedValue(0),
            }),
        };
        const channelRepo = { findOne: vitest_1.vi.fn().mockResolvedValue((_e = opts === null || opts === void 0 ? void 0 : opts.channel) !== null && _e !== void 0 ? _e : { customFields: {} }) };
        const customerRepo = { findOne: vitest_1.vi.fn().mockResolvedValue((_f = opts === null || opts === void 0 ? void 0 : opts.customer) !== null && _f !== void 0 ? _f : null) };
        const connection = {
            getRepository: vitest_1.vi.fn((_c, entity) => {
                if (entity === coupon_template_entity_1.CouponTemplate)
                    return templateRepo;
                if (entity === coupon_bundle_entity_1.CouponBundle)
                    return bundleRepo;
                if (entity === coupon_sale_order_entity_1.CouponSaleOrder)
                    return saleOrderRepo;
                if (entity === core_1.Channel)
                    return channelRepo;
                if (entity === core_1.Customer)
                    return customerRepo;
                throw new Error(`unknown entity: ${entity}`);
            }),
        };
        const couponService = new coupon_service_1.CouponService({}, {}, {});
        const settlementService = { onSaleOrderRefunded: vitest_1.vi.fn().mockResolvedValue({ cancelled: 0, reversed: 0, failed: 0 }) };
        return new coupon_sale_service_1.CouponSaleService(connection, couponService, {}, settlementService);
    }
    const tpl = (over) => (Object.assign({ enabled: true, salePrice: 990, distributionChannels: 'SALE' }, over));
    (0, vitest_1.it)('跨渠道券（channels=[1]，ctx=37）不进目录', async () => {
        const svc = makeService([
            tpl({ id: 1, channels: [{ id: 37 }] }), // 本店券 → 可见
            tpl({ id: 2, channels: [{ id: 1 }] }), // 别家店券 → 隐藏
        ]);
        const { templates } = await svc.saleCatalogue(ctx);
        (0, vitest_1.expect)(templates.map(t => t.id)).toEqual([1]);
    });
    (0, vitest_1.it)('channels 为空的平台券不限渠道 → 仍可见', async () => {
        const svc = makeService([tpl({ id: 3, channels: [] })]);
        const { templates } = await svc.saleCatalogue(ctx);
        (0, vitest_1.expect)(templates.map(t => t.id)).toEqual([3]);
    });
    (0, vitest_1.it)('禁用 / 无售价的券照旧过滤', async () => {
        const svc = makeService([
            tpl({ id: 4, enabled: false, channels: [{ id: 37 }] }),
            tpl({ id: 5, salePrice: 0, channels: [{ id: 37 }] }),
        ]);
        const { templates } = await svc.saleCatalogue(ctx);
        (0, vitest_1.expect)(templates).toEqual([]);
    });
    (0, vitest_1.it)('已售数聚合：PAID 出售单按 templateId/bundleId 计数，无成交为 0', async () => {
        const bundle = { id: 9, enabled: true, channelId: 37, salePrice: 880 };
        const svc = makeService([tpl({ id: 1, channels: [{ id: 37 }] }), tpl({ id: 2, channels: [{ id: 37 }] })], {
            tplRows: [
                { templateId: '1', cnt: '12' }, // postgres raw 计数为字符串
            ],
            bundleRows: [{ bundleId: '9', cnt: '3' }],
            bundles: [bundle],
        });
        const { templates, bundles } = await svc.saleCatalogue(ctx);
        (0, vitest_1.expect)(templates.find(t => t.id === 1).soldCount).toBe(12);
        (0, vitest_1.expect)(templates.find(t => t.id === 2).soldCount).toBe(0);
        (0, vitest_1.expect)(bundles[0].soldCount).toBe(3);
    });
    (0, vitest_1.it)('活动位：窗口内 + 关联券命中本店目录 → campaign 下发（他店券被过滤）', async () => {
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
        const { campaign } = await svc.saleCatalogue(Object.assign(Object.assign({}, ctx), { languageCode: 'zh_Hans' }));
        (0, vitest_1.expect)(campaign).not.toBeNull();
        (0, vitest_1.expect)(campaign.name).toBe('周末限时特惠');
        (0, vitest_1.expect)(campaign.templates.map(t => t.id)).toEqual([1]);
        (0, vitest_1.expect)(campaign.endsAt).toBe(new Date(nowMs + 3600e3).toISOString());
    });
    (0, vitest_1.it)('活动位：窗口外 / 未配置 / 禁用 → campaign 为 null', async () => {
        const past = JSON.stringify({ name: '旧活动', endsAt: '2020-01-01T00:00:00Z', templateIds: [1] });
        (0, vitest_1.expect)((await makeService([tpl({ id: 1, channels: [{ id: 37 }] })], { channel: { customFields: { couponCampaign: past } } }).saleCatalogue(ctx)).campaign).toBeNull();
        (0, vitest_1.expect)((await makeService([tpl({ id: 1, channels: [{ id: 37 }] })], { channel: { customFields: {} } }).saleCatalogue(ctx)).campaign).toBeNull();
        const notStarted = JSON.stringify({ name: '预告', startsAt: '2031-01-01T00:00:00Z', endsAt: '2031-01-02T00:00:00Z', templateIds: [1] });
        (0, vitest_1.expect)((await makeService([tpl({ id: 1, channels: [{ id: 37 }] })], { channel: { customFields: { couponCampaign: notStarted } } }).saleCatalogue(ctx)).campaign).toBeNull();
        const off = JSON.stringify({ name: 'x', endsAt: '2030-01-01T00:00:00Z', templateIds: [1], enabled: false });
        (0, vitest_1.expect)((await makeService([tpl({ id: 1, channels: [{ id: 37 }] })], { channel: { customFields: { couponCampaign: off } } }).saleCatalogue(ctx)).campaign).toBeNull();
    });
});
(0, vitest_1.describe)('倒计时活动位纯函数', () => {
    const saleable = [{ id: 83 }, { id: 84 }, { id: 90 }];
    (0, vitest_1.it)('parseCouponCampaignConfig：坏 JSON / 非对象 / 空值 → null；字段规整', () => {
        (0, vitest_1.expect)((0, coupon_sale_2.parseCouponCampaignConfig)(null)).toBeNull();
        (0, vitest_1.expect)((0, coupon_sale_2.parseCouponCampaignConfig)('')).toBeNull();
        (0, vitest_1.expect)((0, coupon_sale_2.parseCouponCampaignConfig)('not-json')).toBeNull();
        (0, vitest_1.expect)((0, coupon_sale_2.parseCouponCampaignConfig)('[1,2]')).toBeNull();
        const cfg = (0, coupon_sale_2.parseCouponCampaignConfig)('{"enabled":false,"name":{"zh":"x"},"endsAt":"2026-10-26T20:00:00+08:00","templateIds":["83","84",-1]}');
        (0, vitest_1.expect)(cfg).toEqual({
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
    (0, vitest_1.it)('parseCouponCampaignConfig：newCustomerOnly 解析（FR-D 新客 1 元购位）', () => {
        var _a;
        const cfg = (0, coupon_sale_2.parseCouponCampaignConfig)('{"enabled":true,"name":"新人1元购","endsAt":"2026-10-26T20:00:00+08:00","templateIds":[83],"newCustomerOnly":true}');
        (0, vitest_1.expect)(cfg === null || cfg === void 0 ? void 0 : cfg.newCustomerOnly).toBe(true);
        (0, vitest_1.expect)((_a = (0, coupon_sale_2.parseCouponCampaignConfig)('{"enabled":true,"endsAt":"2026-10-26T12:00:00Z","templateIds":[83]}')) === null || _a === void 0 ? void 0 : _a.newCustomerOnly).toBe(false);
    });
    (0, vitest_1.it)('resolveActiveCampaign：时间窗判定 + 配置顺序 + 命中过滤', () => {
        const cfg = { enabled: true, name: '闪购', startsAt: null, endsAt: '2026-10-26T12:00:00Z', templateIds: [90, 84, 999] };
        const view = (0, coupon_sale_2.resolveActiveCampaign)(cfg, saleable, new Date('2026-10-24T00:00:00Z'), 'zh_Hans');
        (0, vitest_1.expect)(view.templates.map(t => t.id)).toEqual([90, 84]);
        (0, vitest_1.expect)(view.endsAt).toBe('2026-10-26T12:00:00.000Z');
        // 未开始
        (0, vitest_1.expect)((0, coupon_sale_2.resolveActiveCampaign)(Object.assign(Object.assign({}, cfg), { startsAt: '2026-12-01T00:00:00Z' }), saleable, new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
        // 已结束 / 缺 endsAt
        (0, vitest_1.expect)((0, coupon_sale_2.resolveActiveCampaign)(cfg, saleable, new Date('2026-10-27T00:00:00Z'), 'zh_Hans')).toBeNull();
        (0, vitest_1.expect)((0, coupon_sale_2.resolveActiveCampaign)(Object.assign(Object.assign({}, cfg), { endsAt: null }), saleable, new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
        // 命中券为空 / 未配置 templateIds
        (0, vitest_1.expect)((0, coupon_sale_2.resolveActiveCampaign)(Object.assign(Object.assign({}, cfg), { templateIds: [999] }), saleable, new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
        (0, vitest_1.expect)((0, coupon_sale_2.resolveActiveCampaign)(Object.assign(Object.assign({}, cfg), { templateIds: [] }), saleable, new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
        // 无 name → null（活动位无标题不展示）
        (0, vitest_1.expect)((0, coupon_sale_2.resolveActiveCampaign)({ enabled: true, name: null, endsAt: '2030-01-01T00:00:00Z', templateIds: [83] }, saleable, new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
    });
    (0, vitest_1.it)('localizeCampaignText：lang 精确 → 去地区码 → 首个非空', () => {
        const v = { zh: '周末特惠', en: 'Weekend Sale' };
        (0, vitest_1.expect)((0, coupon_sale_2.localizeCampaignText)(v, 'zh_Hans')).toBe('周末特惠');
        (0, vitest_1.expect)((0, coupon_sale_2.localizeCampaignText)(v, 'en')).toBe('Weekend Sale');
        (0, vitest_1.expect)((0, coupon_sale_2.localizeCampaignText)({ zh: '仅中文' }, 'en')).toBe('仅中文');
        (0, vitest_1.expect)((0, coupon_sale_2.localizeCampaignText)('纯字符串', 'zh_Hans')).toBe('纯字符串');
        (0, vitest_1.expect)((0, coupon_sale_2.localizeCampaignText)({ zh: '  ' }, 'zh_Hans')).toBeNull();
        (0, vitest_1.expect)((0, coupon_sale_2.localizeCampaignText)(null, 'zh_Hans')).toBeNull();
    });
});
//# sourceMappingURL=coupon-sale.spec.js.map