import { DeepPartial, VendureEntity } from '@vendure/core';
/** 点赞行（同 postId+customerId 唯一：存在即已赞，删除即取消） */
export declare class CircleLike extends VendureEntity {
    constructor(input?: DeepPartial<CircleLike>);
    postId: number;
    customerId: number;
    channelId: number;
}
