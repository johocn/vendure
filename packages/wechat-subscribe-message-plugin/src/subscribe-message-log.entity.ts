import { Column, Entity, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

export type SubscribeMessageStatus = 'pending' | 'sent' | 'failed';

@Entity()
export class SubscribeMessageLog extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<SubscribeMessageLog>) {
        super(input);
    }

    @Column() customerId: number;

    @Column() openid: string;

    @Column() templateId: string;

    @Column({ type: 'simple-json' })
    data: Record<string, { value: string; color?: string }>;

    @Column({ type: 'varchar', default: 'pending' }) status: SubscribeMessageStatus;

    @Column({ type: 'varchar', nullable: true }) page: string | null;

    @Column({ type: 'varchar', nullable: true }) miniprogramState: string | null;

    @Column({ type: 'text', nullable: true }) errorMsg: string | null;

    @Column({ type: 'varchar', nullable: true }) msgId: string | null;

    @Column({ nullable: true }) sentAt?: Date;

    @ManyToOne(() => Channel) channel: Channel;

    @Column() channelId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
