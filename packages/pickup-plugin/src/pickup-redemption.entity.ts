import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';

export type PickupRedemptionStatus = 'generated' | 'redeemed' | 'void';

@Entity()
export class PickupRedemption extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<PickupRedemption>) {
        super(input);
    }

    @Index()
    @Column()
    channelId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];

    @Index({ unique: true })
    @Column()
    orderId: number;

    @Index({ unique: true })
    @Column()
    code: string;

    @Column({ default: 'generated' })
    status: PickupRedemptionStatus;

    @Column({ type: 'datetime', nullable: true })
    claimedAt?: Date | null;

    @Column({ type: 'int', nullable: true })
    claimedByUserId?: number | null;

    @Column({ type: 'varchar', nullable: true })
    claimChannel?: 'customer' | 'shop' | null;
}