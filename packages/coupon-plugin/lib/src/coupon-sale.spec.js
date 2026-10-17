"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const coupon_sale_1 = require("./coupon-sale");
const coupon_service_1 = require("./coupon.service");
const coupon_sale_service_1 = require("./coupon-sale.service");
const coupon_template_entity_1 = require("./coupon-template.entity");
const coupon_bundle_entity_1 = require("./coupon-bundle.entity");
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
(0, vitest_1.describe)('CouponSaleService.saleCatalogue 渠道隔离', () => {
    const ctx = { channel: { id: 37 }, channelId: 37 };
    function makeService(allTemplates) {
        const templateRepo = { find: vitest_1.vi.fn().mockResolvedValue(allTemplates) };
        const bundleRepo = { find: vitest_1.vi.fn().mockResolvedValue([]) };
        const connection = {
            getRepository: vitest_1.vi.fn((_c, entity) => {
                if (entity === coupon_template_entity_1.CouponTemplate)
                    return templateRepo;
                if (entity === coupon_bundle_entity_1.CouponBundle)
                    return bundleRepo;
                throw new Error(`unknown entity: ${entity}`);
            }),
        };
        const couponService = new coupon_service_1.CouponService({}, {}, {});
        return new coupon_sale_service_1.CouponSaleService(connection, couponService, {});
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
});
//# sourceMappingURL=coupon-sale.spec.js.map