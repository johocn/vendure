import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export type SubscribeMessageStatus = 'pending' | 'sent' | 'failed';
export declare class SubscribeMessageLog extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<SubscribeMessageLog>);
    customerId: number;
    openid: string;
    templateId: string;
    data: Record<string, {
        value: string;
        color?: string;
    }>;
    status: SubscribeMessageStatus;
    page: string | null;
    miniprogramState: string | null;
    errorMsg: string | null;
    msgId: string | null;
    sentAt?: Date;
    channel: Channel;
    channelId: number;
    channels: Channel[];
}
