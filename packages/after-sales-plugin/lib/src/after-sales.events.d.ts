import { RequestContext, VendureEvent } from '@vendure/core';
/**
 * 售后单状态流转事件（AfterSalesService.commitState 统一出口发布）。
 * 人工操作 / 超时自动化 / 换货发货均经统一出口，事件自动全覆盖（三期设计 §一）。
 */
export declare class AfterSalesStateTransitionEvent extends VendureEvent {
    readonly ctx: RequestContext;
    readonly requestId: number;
    readonly orderId: number;
    readonly type: string;
    readonly fromState: string | null;
    readonly toState: string;
    readonly customerId: number | null;
    readonly orderCode: string | null;
    readonly createdAt: Date;
    constructor(ctx: RequestContext, requestId: number, orderId: number, type: string, fromState: string | null, toState: string, customerId: number | null, orderCode: string | null, createdAt: Date);
}
/**
 * 商家侧售后提醒事件（超时自动化等内部触发场景发布，notification-plugin 订阅落站内信）。
 * 经 EventBus 解耦：本插件可独立使用（未装 notification-plugin 时事件无人订阅，仅无提醒）。
 */
export declare class AfterSalesMerchantNotifyEvent extends VendureEvent {
    readonly ctx: RequestContext;
    readonly requestId: number;
    readonly title: string;
    readonly content: string;
    constructor(ctx: RequestContext, requestId: number, title: string, content: string);
}
