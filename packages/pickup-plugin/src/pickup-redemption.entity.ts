import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';

export type PickupRedemptionStatus = 'generated' | 'redeemed' | 'void';

@Entity()
export class PickupRedemption extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<PickupRedemption>) {
        super(input);
    }

    @Index()
    @Column({ type: 'int' })
    channelId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];

    @Index({ unique: true })
    @Column({ type: 'int' })
    orderId: number;

    @Index({ unique: true })
    @Column({ type: 'varchar' })
    code: string;

    @Column({ type: 'varchar', default: 'generated' })
    status: PickupRedemptionStatus;

    // 跨库安全（sqljs/SQLite→datetime，PostgreSQL→timestamp）：仅声明可选 Date，TypeORM 按驱动映射
    @Column({ nullable: true })
    claimedAt?: Date;

    @Column({ type: 'int', nullable: true })
    claimedByUserId?: number | null;

    @Column({ type: 'varchar', nullable: true })
    claimChannel?: 'customer' | 'shop' | null;
}