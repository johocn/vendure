import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class Distributor extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Distributor>) {
        super(input);
    }

    @Column() customerId: string;

    @Column({ nullable: true }) parentId: string;

    @Column({ default: 1 }) level: number;

    @Column({ default: 'pending' }) status: 'active' | 'frozen' | 'pending';

    @Column({ default: 0 }) totalEarnings: number;

    @Column({ default: 0 }) availableBalance: number;

    @Column({ default: 0 }) frozenBalance: number;

    @Column({ unique: true }) referralCode: string;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
