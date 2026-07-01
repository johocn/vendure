"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.couponStackableCondition = void 0;
const core_1 = require("@vendure/core");
exports.couponStackableCondition = new core_1.PromotionCondition({
    code: 'coupon_stackable_check',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '优惠券叠加检查' },
        { languageCode: core_1.LanguageCode.en, value: 'Coupon Stackable Check' },
    ],
    args: {},
    check(ctx, order, args, promotion) {
        var _a, _b, _c, _d;
        const pcf = promotion.customFields;
        const ccf = ctx.channel.customFields;
        const globalDefault = (_a = ccf === null || ccf === void 0 ? void 0 : ccf.couponStackable) !== null && _a !== void 0 ? _a : false;
        const globalMax = ccf === null || ccf === void 0 ? void 0 : ccf.maxStackableCount;
        const stackable = (_b = pcf === null || pcf === void 0 ? void 0 : pcf.stackable) !== null && _b !== void 0 ? _b : globalDefault;
        const stackableGroup = pcf === null || pcf === void 0 ? void 0 : pcf.stackableGroup;
        const effectiveMax = (_c = pcf === null || pcf === void 0 ? void 0 : pcf.maxStackableWith) !== null && _c !== void 0 ? _c : globalMax;
        if (!stackable && order.promotions && order.promotions.length > 0) {
            return false;
        }
        if (stackableGroup) {
            const sameGroup = (_d = order.promotions) === null || _d === void 0 ? void 0 : _d.filter((p) => { var _a; return ((_a = p.customFields) === null || _a === void 0 ? void 0 : _a.stackableGroup) === stackableGroup; });
            if (sameGroup && sameGroup.length > 0) {
                return false;
            }
        }
        if (effectiveMax != null && order.promotions && order.promotions.length >= effectiveMax) {
            return false;
        }
        return true;
    },
    priorityValue: 1000,
});
//# sourceMappingURL=coupon-stackable-condition.js.map