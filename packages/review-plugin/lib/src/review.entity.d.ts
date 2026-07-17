import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export declare class Review extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Review>);
    customerId: number;
    productId: number;
    orderLineId: number | null;
    variantId: number | null;
    rating: number;
    content: string;
    images: string[] | null;
    videos: string[] | null;
    tags: string[] | null;
    isAnonymous: boolean;
    status: string;
    reply: string | null;
    repliedAt: Date | null;
    helpfulCount: number;
    channel: Channel;
    channelId: number;
    channels: Channel[];
}
