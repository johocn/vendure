import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

export type InboxRecipientType = 'customer' | 'admin';

/**
 * 站内信消息（事件驱动写入，真实落库）。
 * recipientType 二选一：customer → customerId；admin → administratorId。
 */
@Entity()
export class InboxMessage extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<InboxMessage>) {
        super(input);
    }

    @Column({ type: 'int' })
    channelId: number;

    @Column('varchar')
    recipientType: InboxRecipientType;

    @Column({ type: 'int', nullable: true })
    customerId: number | null;

    @Column({ type: 'int', nullable: true })
    administratorId: number | null;

    @Column('varchar')
    scene: string;

    @Column('varchar')
    title: string;

    @Column('text')
    content: string;

    @Column({ type: 'varchar', nullable: true })
    link: string | null;

    @Column({ type: 'boolean', default: false })
    isRead: boolean;

    /** 可选 Date 列勿写死 type（阶段11 铁律），TypeORM 反射 Date 按驱动映射。 */
    @Column({ nullable: true })
    readAt?: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}