import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export declare class MessageDelivery extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<MessageDelivery>);
    messageId: number;
    customerId: number;
    deliveryStatus: 'pending' | 'sent' | 'failed';
    deliveryError?: string;
    readAt?: Date;
    channels: Channel[];
}
