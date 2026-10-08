"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupBuyFailedEvent = exports.GroupBuyCompletedEvent = void 0;
const core_1 = require("@vendure/core");
/** 成团：targetCount 达成，activity 置 completed 后发布 */
class GroupBuyCompletedEvent extends core_1.VendureEvent {
    constructor(ctx, activityId, orderIds) {
        super();
        this.ctx = ctx;
        this.activityId = activityId;
        this.orderIds = orderIds;
    }
}
exports.GroupBuyCompletedEvent = GroupBuyCompletedEvent;
/** 不成团：endAt 过期且未达 targetCount，activity 置 expired 后发布 */
class GroupBuyFailedEvent extends core_1.VendureEvent {
    constructor(ctx, activityId, orderIds) {
        super();
        this.ctx = ctx;
        this.activityId = activityId;
        this.orderIds = orderIds;
    }
}
exports.GroupBuyFailedEvent = GroupBuyFailedEvent;
//# sourceMappingURL=events.js.map