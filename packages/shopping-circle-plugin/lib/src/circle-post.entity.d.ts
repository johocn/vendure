import { Channel, DeepPartial, VendureEntity } from '@vendure/core';
export declare class CirclePost extends VendureEntity {
    constructor(input?: DeepPartial<CirclePost>);
    customerId: number;
    /** ≤50 字（对齐 usemall note.vue） */
    title: string | null;
    content: string;
    /** JSON 字符串数组（uploadCustomerAsset 的 source 列表） */
    images: string | null;
    videoUrl: string | null;
    /** 「买同款」跳转的商品 id */
    productId: string | null;
    likeCount: number;
    favoriteCount: number;
    status: 'published' | 'hidden';
    isPinned: boolean;
    channel: Channel;
    channelId: number;
}
