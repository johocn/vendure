import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

import { RewardRule } from './types';

@Entity()
export class GroupBuyActivity extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<GroupBuyActivity>) {
        super(input);
    }

    @Column() name: string;

    @Column() description: string;

    @Column() targetCount: number;

    @Column({ default: 0 }) currentCount: number;

    @Column({ default: 0 }) maxCount: number;

    @Column({ default: 'active' }) status: 'active' | 'completed' | 'expired';

    @Column() startAt: Date;

    @Column() endAt: Date;

    @Column() productId: number;

    @Column() variantId: number;

    @Column() groupPrice: number;

    @Column({ default: 0 }) leaderDiscount: number;

    @Column({ default: 'discount' }) leaderRewardType: 'discount' | 'cashback' | 'free';

    @Column('simple-json', { nullable: true }) rewardRules: RewardRule[];

    @Column({ default: true }) autoConfirm: boolean;

    @Column({ default: false }) allowJoinAfterComplete: boolean;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
