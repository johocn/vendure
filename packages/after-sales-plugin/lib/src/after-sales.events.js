"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AfterSalesMerchantNotifyEvent = exports.AfterSalesStateTransitionEvent = void 0;
const core_1 = require("@vendure/core");
/**
 * 售后单状态流转事件（AfterSalesService.commitState 统一出口发布）。
 * 人工操作 / 超时自动化 / 换货发货均经统一出口，事件自动全覆盖（三期设计 §一）。
 */
class AfterSalesStateTransitionEvent extends core_1.VendureEvent {
    constructor(ctx, requestId, orderId, type, fromState, toState, customerId, orderCode, createdAt) {
        super();
        this.ctx = ctx;
        this.requestId = requestId;
        this.orderId = orderId;
        this.type = type;
        this.fromState = fromState;
        this.toState = toState;
        this.customerId = customerId;
        this.orderCode = orderCode;
        this.createdAt = createdAt;
    }
}
exports.AfterSalesStateTransitionEvent = AfterSalesStateTransitionEvent;
/**
 * 商家侧售后提醒事件（超时自动化等内部触发场景发布，notification-plugin 订阅落站内信）。
 * 经 EventBus 解耦：本插件可独立使用（未装 notification-plugin 时事件无人订阅，仅无提醒）。
 */
class AfterSalesMerchantNotifyEvent extends core_1.VendureEvent {
    constructor(ctx, requestId, title, content) {
        super();
        this.ctx = ctx;
        this.requestId = requestId;
        this.title = title;
        this.content = content;
    }
}
exports.AfterSalesMerchantNotifyEvent = AfterSalesMerchantNotifyEvent;
//# sourceMappingURL=after-sales.events.js.map