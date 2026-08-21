"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preSaleDiscountCondition = void 0;
const core_1 = require("@vendure/core");
const pre_sale_activity_entity_1 = require("./pre-sale-activity.entity");
const pre_sale_runtime_1 = require("./pre-sale-runtime");
/**
 * 预售价条件：读 order.customFields.preSaleActivityId，
 * 运行时查询活动并校验（存在、非 ended、窗口内、库存未售罄）后，
 * 返回 state `{ variantId, presalePrice, usePresale }` 供 pre_sale_price 动作取价。
 *
 * 与阶段14/15 一致：活动配置运行时动态读取，无需在管理端按活动手工配 args。
 */
exports.preSaleDiscountCondition = new core_1.PromotionCondition({
    code: 'pre_sale_discount',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '预售优惠' },
        { languageCode: core_1.LanguageCode.en, value: 'Pre-sale Discount' },
    ],
    args: {},
    async check(ctx, order) {
        var _a, _b;
        const activityId = (_a = order === null || order === void 0 ? void 0 : order.customFields) === null || _a === void 0 ? void 0 : _a.preSaleActivityId;
        if (activityId == null)
            return false;
        const activity = await (0, pre_sale_runtime_1.getPreSaleConnection)()
            .getRepository(ctx, pre_sale_activity_entity_1.PreSaleActivity)
            .findOne({ where: { id: activityId } });
        if (!activity)
            return false;
        const now = new Date();
        // active / delivered（到货但仍在锁定价窗口内）都享预售价；ended 不再优惠
        if (activity.status !== 'active' && activity.status !== 'delivered')
            return false;
        if (activity.startAt && now < activity.startAt)
            return false;
        if (activity.endAt && now > activity.endAt)
            return false;
        // 库存售罄不再优惠（存量已占满）
        if (activity.soldCount >= activity.totalStock)
            return false;
        // 无价格分档（presalePrice<=0）不套价
        if (!(activity.presalePrice > 0))
            return false;
        // 订单须包含预售变体行，避免对非预售商品误打折
        const lines = (_b = order === null || order === void 0 ? void 0 : order.lines) !== null && _b !== void 0 ? _b : [];
        const hasVariant = lines.some((l) => (l === null || l === void 0 ? void 0 : l.productVariant) && String(l.productVariant.id) === String(activity.variantId));
        if (!hasVariant)
            return false;
        return {
            variantId: String(activity.variantId),
            presalePrice: activity.presalePrice,
            usePresale: true,
        };
    },
    priorityValue: 900,
});
//# sourceMappingURL=pre-sale-promotion-condition.js.map