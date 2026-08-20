import { LanguageCode, PromotionCondition, RequestContext } from '@vendure/core';

import { GroupBuyLeaderRewardConditionState } from './types';
import { GroupBuyActivity } from './group-buy-activity.entity';
import { getGroupBuyConnection } from './group-buy-runtime';

/**
 * 拼团团长奖励条件：订单为团长拼团单（isGroupBuyLeader）且活动存在、
 * 奖励类型为 discount 且有面额时，返回 state `{ variantId, leaderDiscount }` 供配套动作取折扣。
 */
export const groupBuyLeaderRewardCondition = new PromotionCondition({
    code: 'group_buy_leader_reward',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '拼团团长奖励' },
        { languageCode: LanguageCode.en, value: 'Group Buy Leader Reward' },
    ],
    args: {},
    async check(ctx: RequestContext, order: any): Promise<GroupBuyLeaderRewardConditionState | false> {
        const ocf = order?.customFields;
        if (ocf?.groupBuyIsLeader !== true) return false;
        const activityId = ocf.groupBuyActivityId;
        if (activityId == null) return false;

        const activity = await getGroupBuyConnection()
            .getRepository(ctx, GroupBuyActivity)
            .findOne({ where: { id: activityId as any } });
        if (!activity) return false;
        if (activity.leaderRewardType !== 'discount' || activity.leaderDiscount <= 0) return false;

        return {
            variantId: String(activity.variantId),
            leaderDiscount: activity.leaderDiscount,
        };
    },
    priorityValue: 890,
});
