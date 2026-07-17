import { Column, Entity, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class CouponCode extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<CouponCode>) {
        super(input);
    }

    @Column() couponId: number;

    @Column() customerId: number;

    @Column({ type: 'text' }) code: string;

    @Column({ type: 'varchar', default: 'unused' }) status: string;

    @Column({ type: 'timestamptz', nullable: true }) claimedAt: Date | null;

    @Column({ type: 'timestamptz', nullable: true }) usedAt: Date | null;

    @Column({ type: 'int', nullable: true }) orderId: number | null;

    @ManyToOne(() => Channel) channel: Channel;

    @Column() channelId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
