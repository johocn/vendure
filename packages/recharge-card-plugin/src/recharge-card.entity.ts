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

    @Column({ default: 'unused' })
    state: RechargeCardState;

    @Column({ nullable: true })
    batchId: number;

    @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
    redeemedBy: Customer | null;

    @Column({ type: 'int', nullable: true })
    redeemedByCustomerId: number | null;

    @Column({ type: 'timestamp', nullable: true })
    redeemedAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    expiresAt: Date | null;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
