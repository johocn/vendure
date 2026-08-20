"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pointsRedeemAction = void 0;
const core_1 = require("@vendure/core");
const points_redeem_condition_1 = require("./points-redeem-condition");
/**
 * 积分抵现动作：配套 pointsRedeemCondition，读 state 中的 pointsRedeemAmount
 * 对订单整体折让（订单级折扣），并 clamp 到当前 subTotalWithTax，防止订单内容
 * 变更后抵扣金额超出实际商品总额。
 *
 * execute 返回负数折扣金额，由 PromotionOrderAction 框架应用到 Order。
 */
exports.pointsRedeemAction = new core_1.PromotionOrderAction({
    code: 'points_redeem_discount',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '积分抵现金额（订单级折扣）' },
        { languageCode: core_1.LanguageCode.en, value: 'Points redemption discount (order level)' },
    ],
    args: {},
    conditions: [points_redeem_condition_1.pointsRedeemCondition],
    async execute(ctx, order, _args, state) {
        var _a;
        const s = state === null || state === void 0 ? void 0 : state.points_redeem;
        if (!(s === null || s === void 0 ? void 0 : s.pointsRedeemAmount))
            return 0;
        const subTotal = (_a = order === null || order === void 0 ? void 0 : order.subTotalWithTax) !== null && _a !== void 0 ? _a : 0;
        if (subTotal <= 0)
            return 0;
        const discount = Math.min(s.pointsRedeemAmount, subTotal);
        if (discount <= 0)
            return 0;
        return -discount;
    },
});
//# sourceMappingURL=points-redeem-action.js.map