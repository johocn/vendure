import { LanguageCode, PromotionCondition } from '@vendure/core';

export const groupBuyLeaderRewardCondition = new PromotionCondition({
    code: 'group_buy_leader_reward',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '拼团团长奖励' },
        { languageCode: LanguageCode.en, value: 'Group Buy Leader Reward' },
    ],
    args: {},
    check: (ctx, order, args) => {
        const ocf = (order as any).customFields;
        return ocf?.groupBuyIsLeader === true && ocf?.groupBuyActivityId != null;
    },
    priorityValue: 890,
});
