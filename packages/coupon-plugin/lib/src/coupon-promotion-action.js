"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.couponDiscountAction = void 0;
const core_1 = require("@vendure/core");
const coupon_promotion_condition_1 = require("./coupon-promotion-condition");
/**
 * 券折扣动作：依赖 coupon_applied 条件。条件已核算出 discountAmount 放在 state，
 * 此处直接取负值（PromotionAction 返回值必须为负数）。
 */
exports.couponDiscountAction = new core_1.PromotionOrderAction({
    code: 'coupon_discount',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '优惠券折扣金额' },
        { languageCode: core_1.LanguageCode.en, value: 'Coupon discount amount' },
    ],
    args: {},
    conditions: [coupon_promotion_condition_1.couponAppliedCondition],
    execute(_ctx, _order, _args, state) {
        var _a, _b;
        // Vendure 会把每条 condition 的返回值按 condition.code 归入 state：
        // state = { coupon_applied: { discountAmount } }。必须嵌套取，否则始终为 0。
        const s = state;
        const amount = (_b = (_a = s === null || s === void 0 ? void 0 : s.coupon_applied) === null || _a === void 0 ? void 0 : _a.discountAmount) !== null && _b !== void 0 ? _b : 0;
        return -amount;
    },
});
//# sourceMappingURL=coupon-promotion-action.js.map