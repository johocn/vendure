import { DeepPartial, VendureEntity } from '@vendure/core';
/** 收藏行（与 CircleLike 同构：同 postId+customerId 唯一） */
export declare class CircleFavorite extends VendureEntity {
    constructor(input?: DeepPartial<CircleFavorite>);
    postId: number;
    customerId: number;
    channelId: number;
}
