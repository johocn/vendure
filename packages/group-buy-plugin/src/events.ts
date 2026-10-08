import { RequestContext, VendureEvent } from '@vendure/core';

/** 成团：targetCount 达成，activity 置 completed 后发布 */
export class GroupBuyCompletedEvent extends VendureEvent {
    constructor(
        public ctx: RequestContext,
        public activityId: number,
        public orderIds: string[],
    ) {
        super();
    }
}

/** 不成团：endAt 过期且未达 targetCount，activity 置 expired 后发布 */
export class GroupBuyFailedEvent extends VendureEvent {
    constructor(
        public ctx: RequestContext,
        public activityId: number,
        public orderIds: string[],
    ) {
        super();
    }
}
