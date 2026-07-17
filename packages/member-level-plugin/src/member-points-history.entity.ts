import { Column, Entity, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

export enum PointsHistoryType {
    EARN = 'earn',
    SPEND = 'spend',
    ADJUST = 'adjust',
    EXPIRE = 'expire',
}

@Entity()
export class MemberPointsHistory extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<MemberPointsHistory>) {
        super(input);
    }

    @Column() customerId: number;

    @Column({ type: 'varchar' }) type: PointsHistoryType;

    @Column({ type: 'int' }) amount: number;

    @Column({ type: 'int' }) balanceBefore: number;

    @Column({ type: 'int' }) balanceAfter: number;

    @Column({ type: 'int', nullable: true }) orderId: number | null;

    @Column({ type: 'text', nullable: true }) remark: string | null;

    @Column({ type: 'timestamptz', nullable: true }) expiresAt: Date | null;

    @ManyToOne(() => Channel) channel: Channel;

    @Column() channelId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
