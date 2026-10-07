import { RequestContext, VendureEvent } from '@vendure/core';

/**
 * 售后单状态流转事件（AfterSalesService.commitState 统一出口发布）。
 * 人工操作 / 超时自动化 / 换货发货均经统一出口，事件自动全覆盖（三期设计 §一）。
 */
export class AfterSalesStateTransitionEvent extends VendureEvent {
    constructor(
        public readonly ctx: RequestContext,
        public readonly requestId: number,
        public readonly orderId: number,
        public readonly type: string,
        public readonly fromState: string | null,
        public readonly toState: string,
        public readonly customerId: number | null,
        public readonly orderCode: string | null,
        public readonly createdAt: Date,
    ) {
        super();
    }
}

/**
 * 商家侧售后提醒事件（超时自动化等内部触发场景发布，notification-plugin 订阅落站内信）。
 * 经 EventBus 解耦：本插件可独立使用（未装 notification-plugin 时事件无人订阅，仅无提醒）。
 */
export class AfterSalesMerchantNotifyEvent extends VendureEvent {
    constructor(
        public readonly ctx: RequestContext,
        public readonly requestId: number,
        public readonly title: string,
        public readonly content: string,
    ) {
        super();
    }
}
