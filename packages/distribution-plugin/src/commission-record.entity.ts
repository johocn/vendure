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

    @Column({ type: 'varchar' }) commissionType: 'direct' | 'indirect';

    @Column({ type: 'int' }) commissionRate: number;

    @Column({ type: 'int' }) orderAmount: number;

    @Column({ type: 'int' }) commissionAmount: number;

    @Column({ type: 'varchar', default: 'pending' }) status: 'pending' | 'confirmed' | 'paid' | 'cancelled';

    @Column({ nullable: true }) settledAt: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
