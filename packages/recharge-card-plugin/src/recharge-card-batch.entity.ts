import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class RechargeCardBatch extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<RechargeCardBatch>) {
        super(input);
    }

    @Column()
    name: string;

    @Column({ nullable: true })
    prefix: string;

    @Column()
    faceValue: number;

    @Column()
    quantity: number;

    @Column({ default: 0 })
    generatedCount: number;

    @Column({ type: 'timestamp', nullable: true })
    expiresAt: Date | null;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
