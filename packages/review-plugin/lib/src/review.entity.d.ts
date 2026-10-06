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
    repliedAt?: Date;
    helpfulCount: number;
    channelId: number;
    channels: Channel[];
    /** 自关联：追评。parentId 为主评 id，NULL 表示主评。聚合只统计 parentId==NULL 的主评。 */
    parentId: number | null;
    /** 评价有礼：主评审核通过时已发放奖励（券/积分任一），幂等闸。 */
    giftGranted: boolean;
    /** 审核时间（approve/reject 留痕）；追评窗口以此为基准。 */
    reviewedAt?: Date | null;
}
