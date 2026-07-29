import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export declare class Message extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Message>);
    title: string;
    body: string;
    deliveryChannel: 'inapp' | 'push';
    audienceType: 'all' | 'level';
    audienceLevel?: number;
    status: 'draft' | 'pending' | 'sending' | 'sent' | 'failed';
    totalTarget: number;
    totalSent: number;
    totalFailed: number;
    sentAt?: Date;
    channels: Channel[];
}
