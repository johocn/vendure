import { RequestContext, VendureEvent } from '@vendure/core';
/** 成团：targetCount 达成，activity 置 completed 后发布 */
export declare class GroupBuyCompletedEvent extends VendureEvent {
    ctx: RequestContext;
    activityId: number;
    orderIds: string[];
    constructor(ctx: RequestContext, activityId: number, orderIds: string[]);
}
/** 不成团：endAt 过期且未达 targetCount，activity 置 expired 后发布 */
export declare class GroupBuyFailedEvent extends VendureEvent {
    ctx: RequestContext;
    activityId: number;
    orderIds: string[];
    constructor(ctx: RequestContext, activityId: number, orderIds: string[]);
}
