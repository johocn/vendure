"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tierDiscountAction = void 0;
const core_1 = require("@vendure/core");
const tier_discount_condition_1 = require("./tier-discount-condition");
/**
 * 会员等级专属折扣动作（订单级）：配套 tierEligibleCondition，
 * 从 state 读当前档位 specialDiscountRate（千分比），按 subTotalWithTax 折让，
 * 并 clamp 到 subTotalWithTax。execute 返回负数折扣，促销框架应用。
 */
exports.tierDiscountAction = new core_1.PromotionOrderAction({
    code: 'tier_discount',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '会员等级专属折扣（订单级）' },
        { languageCode: core_1.LanguageCode.en, value: 'Member tier special discount' },
    ],
    args: {},
    conditions: [tier_discount_condition_1.tierEligibleCondition],
    async execute(ctx, order, _args, state) {
        var _a, _b;
        const s = state === null || state === void 0 ? void 0 : state.tier_eligible;
        const rate = (_a = s === null || s === void 0 ? void 0 : s.specialDiscountRate) !== null && _a !== void 0 ? _a : 0;
        if (rate <= 0)
            return 0;
        const subTotal = (_b = order === null || order === void 0 ? void 0 : order.subTotalWithTax) !== null && _b !== void 0 ? _b : 0;
        if (subTotal <= 0)
            return 0;
        const discount = Math.floor((subTotal * rate) / 1000);
        if (discount <= 0)
            return 0;
        return -discount;
    },
});
//# sourceMappingURL=tier-discount-action.js.map