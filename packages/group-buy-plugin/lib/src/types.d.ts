export interface RewardRule {
    excessCount: number;
    rewardType: 'discount' | 'cashback' | 'gift';
    rewardValue: number;
}
export interface GroupBuyPluginOptions {
    defaultTimeoutMinutes?: number;
}
/** group_buy_discount 条件返回给 group_buy_price 动作的 state */
export type GroupBuyDiscountConditionState = {
    activityId: string;
    variantId: string;
    groupPrice: number;
};
/** group_buy_leader_reward 条件返回给 group_buy_leader_reward 动作的 state */
export type GroupBuyLeaderRewardConditionState = {
    variantId: string;
    leaderDiscount: number;
};
