export interface RewardRule {
    excessCount: number;
    rewardType: 'discount' | 'cashback' | 'gift';
    rewardValue: number;
}

export interface GroupBuyPluginOptions {
    defaultTimeoutMinutes?: number;
}

/** group_buy_discount 条件返回给 group_buy_price 动作的 state */
// 用 type 别名而非 interface：type 别名与 Record<string, unknown>（PromotionConditionState）兼容，
// interface 缺少隐式索引签名会报 TS2322。
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
