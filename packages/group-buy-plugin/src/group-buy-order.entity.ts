import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class GroupBuyOrder extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<GroupBuyOrder>) {
        super(input);
    }

    @Column() groupBuyActivityId: string;

    @Column() orderId: string;

    @Column() isLeader: boolean;

    @Column({ default: 'pending' }) status: 'pending' | 'success' | 'failed';

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
