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

    @Column({ nullable: true })
    expiresAt?: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];

    plaintextPins?: { code: string; pin: string }[];
}
