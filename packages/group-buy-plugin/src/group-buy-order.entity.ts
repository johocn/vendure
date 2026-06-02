import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class GroupBuyOrder extends VendureEntity {
    constructor(input?: DeepPartial<GroupBuyOrder>) {
        super(input);
    }

    @Column() groupBuyActivityId: string;

    @Column() orderId: string;

    @Column() isLeader: boolean;

    @Column({ default: 'pending' }) status: 'pending' | 'success' | 'failed';
}
