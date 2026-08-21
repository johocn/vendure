import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

@Entity()
export class CommunityActivityItem extends VendureEntity {
    constructor(input?: DeepPartial<CommunityActivityItem>) {
        super(input);
    }
    @Index()
    @Column()
    activityId: number;

    @Column({ type: 'int' })
    variantId: number;

    @Column({ type: 'bigint' }) // 活动价(分)
    price: number;

    @Column({ type: 'int', nullable: true })
    stockLimit?: number | null;
}