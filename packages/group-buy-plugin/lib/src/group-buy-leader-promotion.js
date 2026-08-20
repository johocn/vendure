"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupBuyLeaderRewardCondition = void 0;
const core_1 = require("@vendure/core");
const group_buy_activity_entity_1 = require("./group-buy-activity.entity");
const group_buy_runtime_1 = require("./group-buy-runtime");
/**
 * 拼团团长奖励条件：订单为团长拼团单（isGroupBuyLeader）且活动存在、
 * 奖励类型为 discount 且有面额时，返回 state `{ variantId, leaderDiscount }` 供配套动作取折扣。
 */
exports.groupBuyLeaderRewardCondition = new core_1.PromotionCondition({
    code: 'group_buy_leader_reward',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '拼团团长奖励' },
        { languageCode: core_1.LanguageCode.en, value: 'Group Buy Leader Reward' },
    ],
    args: {},
    async check(ctx, order) {
        const ocf = order === null || order === void 0 ? void 0 : order.customFields;
        if ((ocf === null || ocf === void 0 ? void 0 : ocf.groupBuyIsLeader) !== true)
            return false;
        const activityId = ocf.groupBuyActivityId;
        if (activityId == null)
            return false;
        const activity = await (0, group_buy_runtime_1.getGroupBuyConnection)()
            .getRepository(ctx, group_buy_activity_entity_1.GroupBuyActivity)
            .findOne({ where: { id: activityId } });
        if (!activity)
            return false;
        if (activity.leaderRewardType !== 'discount' || activity.leaderDiscount <= 0)
            return false;
        return {
            variantId: String(activity.variantId),
            leaderDiscount: activity.leaderDiscount,
        };
    },
    priorityValue: 890,
});
//# sourceMappingURL=group-buy-leader-promotion.js.map