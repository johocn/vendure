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
