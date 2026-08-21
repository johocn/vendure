import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';

export type CommunityLeaderStatus = 'applied' | 'active' | 'suspended';

@Entity()
export class CommunityLeader extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<CommunityLeader>) {
        super(input);
    }
    @Index()
    @Column()
    channelId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];

    @Index({ unique: true })
    @Column({ type: 'int' })
    userId: number; // 关联买家 User

    @Column({ type: 'int', nullable: true })
    customerId?: number | null;

    @Column({ type: 'int' })
    pickupLocationId: number; // 绑定自提点

    @Column({ default: 'applied' })
    status: CommunityLeaderStatus;

    @Column({ type: 'bigint', default: 0 })
    totalCommission: number; // 分
}