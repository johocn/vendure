import { RequestContext, VendureEvent } from '@vendure/core';

/**
 * 生态钩子事件：直接佣金记录落库后由 CommissionService 发布。
 * 供外部插件（如 eco-plugin）订阅后上报 distribute 生态行为；
 * 事件发布失败不影响佣金主流程（发布处 try/catch 静默）。
 */
export class CommissionRecordCreatedEvent extends VendureEvent {
    constructor(
        public readonly ctx: RequestContext,
        public readonly orderId: string,
        public readonly orderCode: string,
        /** 获得直接佣金的 inviter（分销商）对应的 customer id */
        public readonly distributorCustomerId: string,
        public readonly commissionType: 'direct' | 'indirect',
    ) {
        super();
    }
}
