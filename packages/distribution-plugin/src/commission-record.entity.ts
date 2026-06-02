import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, ID, VendureEntity } from '@vendure/core';

@Entity()
export class CommissionRecord extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<CommissionRecord>) {
        super(input);
    }

    @Column() distributorId: ID;

    @Column() orderId: ID;

    @Column({ nullable: true }) orderLineId: ID;

    @Column({ nullable: true }) fromDistributorId: ID;

    @Column() commissionType: 'direct' | 'indirect';

    @Column() commissionRate: number;

    @Column() orderAmount: number;

    @Column() commissionAmount: number;

    @Column({ default: 'pending' }) status: 'pending' | 'confirmed' | 'paid' | 'cancelled';

    @Column({ type: 'datetime', nullable: true }) settledAt: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
