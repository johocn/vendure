import { Channel, ChannelAware, DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';

@Entity()
@Index(['messageId', 'customerId'])
@Index(['customerId', 'readAt'])
export class MessageDelivery extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<MessageDelivery>) {
        super(input);
    }

    @Column() messageId: number;
    @Column() customerId: number;
    @Column({ default: 'pending' }) deliveryStatus: 'pending' | 'sent' | 'failed';
    @Column({ type: 'text', nullable: true }) deliveryError?: string;
    @Column({ type: 'datetime', nullable: true }) readAt?: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
