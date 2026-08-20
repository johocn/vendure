"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupBuyLeaderRewardAction = void 0;
const core_1 = require("@vendure/core");
const group_buy_leader_promotion_1 = require("./group-buy-leader-promotion");
/**
 * 拼团团长折扣动作：依赖 group_buy_leader_reward 条件（条件已把 leaderDiscount 放入 state）。
 * 仅对命中拼团变体的行折让 leaderDiscount（PromotionItemAction 返回值须为负数）。
 *
 * TODO: leaderRewardType=cashback（返现）与 free（免单）涉及独立状态机与副作用，暂留待后续。
 */
exports.groupBuyLeaderRewardAction = new core_1.PromotionItemAction({
    code: 'group_buy_leader_reward',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '拼团团长折扣' },
        { languageCode: core_1.LanguageCode.en, value: 'Group buy leader discount' },
    ],
    args: {},
    conditions: [group_buy_leader_promotion_1.groupBuyLeaderRewardCondition],
    async execute(ctx, orderLine, _args, state) {
        // state 按条件 code 嵌套：state = { group_buy_leader_reward: { leaderDiscount, variantId } }
        const s = state === null || state === void 0 ? void 0 : state.group_buy_leader_reward;
        if (!(s === null || s === void 0 ? void 0 : s.leaderDiscount))
            return 0;
        if (!(orderLine === null || orderLine === void 0 ? void 0 : orderLine.productVariant) || String(orderLine.productVariant.id) !== String(s.variantId)) {
            return 0;
        }
        return -s.leaderDiscount;
    },
});
//# sourceMappingURL=group-buy-leader-reward-action.js.map