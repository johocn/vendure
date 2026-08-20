import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
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

    @Column({ type: 'int' }) customerId: number;

    @Column({ type: 'varchar' }) type: PointsHistoryType;

    @Column({ type: 'int' }) amount: number;

    @Column({ type: 'int' }) balanceBefore: number;

    @Column({ type: 'int' }) balanceAfter: number;

    @Column({ type: 'int', nullable: true }) orderId: number | null;

    @Column({ type: 'text', nullable: true }) remark: string | null;

    @Column({ nullable: true }) expiresAt?: Date;

    @Column({ type: 'int' }) channelId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
