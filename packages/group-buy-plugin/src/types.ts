export interface RewardRule {
    excessCount: number;
    rewardType: 'discount' | 'cashback' | 'gift';
    rewardValue: number;
}

export interface GroupBuyPluginOptions {
    defaultTimeoutMinutes?: number;
}
