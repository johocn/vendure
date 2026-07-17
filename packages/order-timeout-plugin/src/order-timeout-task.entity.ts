import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, JoinTable, ManyToMany, ManyToOne } from 'typeorm';

export enum TimeoutType {
    PAYMENT = 'payment',
    FULFILLMENT = 'fulfillment',
    RECEIPT = 'receipt',
    REVIEW = 'review',
}

export enum TimeoutTaskStatus {
    PENDING = 'pending',
    EXECUTED = 'executed',
    CANCELLED = 'cancelled',
    FAILED = 'failed',
}

@Entity()
export class OrderTimeoutTask extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<OrderTimeoutTask>) {
        super(input);
    }

    @Column({ type: 'varchar' }) type: TimeoutType;
    @Column() orderId: number;
    @Column() channelId: number;
    @Column({ type: 'timestamptz' }) dueAt: Date;
    @Column({ type: 'varchar', default: TimeoutTaskStatus.PENDING }) status: TimeoutTaskStatus;
    @Column({ type: 'int', default: 0 }) retryCount: number;
    @Column({ type: 'text', nullable: true }) lastError: string | null;
    @Column({ type: 'timestamptz', nullable: true }) executedAt: Date | null;
    @ManyToOne(() => Channel) channel: Channel;
    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
