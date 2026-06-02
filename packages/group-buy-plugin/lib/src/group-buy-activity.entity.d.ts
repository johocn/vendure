import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
import { RewardRule } from './types';
export declare class GroupBuyActivity extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<GroupBuyActivity>);
    name: string;
    description: string;
    targetCount: number;
    currentCount: number;
    maxCount: number;
    status: 'active' | 'completed' | 'expired';
    startAt: Date;
    endAt: Date;
    productId: number;
    variantId: number;
    groupPrice: number;
    leaderDiscount: number;
    leaderRewardType: 'discount' | 'cashback' | 'free';
    rewardRules: RewardRule[];
    autoConfirm: boolean;
    allowJoinAfterComplete: boolean;
    channels: Channel[];
}
