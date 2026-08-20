"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pointsRedeemCondition = void 0;
const core_1 = require("@vendure/core");
/**
 * 积分抵现条件：读 order.customFields.pointsToRedeem / pointsRedeemAmount，
 * 绑定即扣策略下金额已在 redeemPoints 时折算并写入订单字段，结算期直接读取（无需 DB）。
 *
 * 返回 state `{ pointsToRedeem, pointsRedeemAmount }` 供 points_redeem_discount 动作折让。
 */
exports.pointsRedeemCondition = new core_1.PromotionCondition({
    code: 'points_redeem',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '积分抵现' },
        { languageCode: core_1.LanguageCode.en, value: 'Points Redemption' },
    ],
    args: {},
    async check(ctx, order) {
        var _a, _b, _c, _d;
        const pointsToRedeem = (_b = (_a = order === null || order === void 0 ? void 0 : order.customFields) === null || _a === void 0 ? void 0 : _a.pointsToRedeem) !== null && _b !== void 0 ? _b : 0;
        if (pointsToRedeem <= 0)
            return false;
        const pointsRedeemAmount = (_d = (_c = order === null || order === void 0 ? void 0 : order.customFields) === null || _c === void 0 ? void 0 : _c.pointsRedeemAmount) !== null && _d !== void 0 ? _d : 0;
        if (pointsRedeemAmount <= 0)
            return false;
        return { pointsToRedeem, pointsRedeemAmount };
    },
    priorityValue: 900,
});
//# sourceMappingURL=points-redeem-condition.js.map