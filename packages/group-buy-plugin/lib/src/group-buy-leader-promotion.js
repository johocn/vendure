"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupBuyLeaderRewardCondition = void 0;
const core_1 = require("@vendure/core");
exports.groupBuyLeaderRewardCondition = new core_1.PromotionCondition({
    code: 'group_buy_leader_reward',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '拼团团长奖励' },
        { languageCode: core_1.LanguageCode.en, value: 'Group Buy Leader Reward' },
    ],
    args: {},
    check: (ctx, order, args) => {
        const ocf = order.customFields;
        return (ocf === null || ocf === void 0 ? void 0 : ocf.groupBuyIsLeader) === true && (ocf === null || ocf === void 0 ? void 0 : ocf.groupBuyActivityId) != null;
    },
    priorityValue: 890,
});
//# sourceMappingURL=group-buy-leader-promotion.js.map