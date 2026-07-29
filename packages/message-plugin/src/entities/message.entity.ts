import { Channel, ChannelAware, DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';

@Entity()
export class Message extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Message>) {
        super(input);
    }

    @Column() title: string;
    @Column({ type: 'text' }) body: string;
    @Column({ default: 'inapp' }) deliveryChannel: 'inapp' | 'push';
    @Column({ default: 'all' }) audienceType: 'all' | 'level';
    @Column({ nullable: true }) audienceLevel?: number;
    @Column({ default: 'draft' }) status: 'draft' | 'pending' | 'sending' | 'sent' | 'failed';
    @Column({ default: 0 }) totalTarget: number;
    @Column({ default: 0 }) totalSent: number;
    @Column({ default: 0 }) totalFailed: number;
    @Column({ type: 'datetime', nullable: true }) sentAt?: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
