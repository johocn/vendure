import { Column, Entity } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

@Entity()
export class GroupBuyOrder extends VendureEntity {
    constructor(input?: DeepPartial<GroupBuyOrder>) {
        super(input);
    }

    @Column() groupBuyActivityId: ID;

    @Column() orderId: ID;

    @Column() isLeader: boolean;

    @Column({ default: 'pending' }) status: 'pending' | 'success' | 'failed';
}
