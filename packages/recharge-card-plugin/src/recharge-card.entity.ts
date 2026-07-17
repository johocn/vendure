import { Column, Entity, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import { Channel, ChannelAware, Customer, DeepPartial, VendureEntity } from '@vendure/core';

import { RechargeCardState } from './types';

@Entity()
export class RechargeCard extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<RechargeCard>) {
        super(input);
    }

    @Column({ unique: true })
    code: string;

    @Column({ nullable: true })
    pinHash: string;

    @Column()
    faceValue: number;

    @Column({ type: 'varchar', default: 'unused' })
    state: RechargeCardState;

    @Column({ nullable: true })
    batchId: number;

    @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
    redeemedBy: Customer | null;

    @Column({ type: 'int', nullable: true })
    redeemedByCustomerId: number | null;

    @Column({ nullable: true })
    redeemedAt?: Date;

    @Column({ nullable: true })
    expiresAt?: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
