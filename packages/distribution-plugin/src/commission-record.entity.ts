import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class CommissionRecord extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<CommissionRecord>) {
        super(input);
    }

    @Column() distributorId: string;

    @Column() orderId: string;

    @Column({ nullable: true }) orderLineId: string;

    @Column({ nullable: true }) fromDistributorId: string;

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
