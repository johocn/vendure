import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export type InboxRecipientType = 'customer' | 'admin';
/**
 * 站内信消息（事件驱动写入，真实落库）。
 * recipientType 二选一：customer → customerId；admin → administratorId。
 */
export declare class InboxMessage extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<InboxMessage>);
    channelId: number;
    recipientType: InboxRecipientType;
    customerId: number | null;
    administratorId: number | null;
    scene: string;
    title: string;
    content: string;
    link: string | null;
    isRead: boolean;
    /** 可选 Date 列勿写死 type（阶段11 铁律），TypeORM 反射 Date 按驱动映射。 */
    readAt?: Date;
    channels: Channel[];
}
