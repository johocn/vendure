import { Injectable } from '@nestjs/common';
import { ForbiddenError, ID, Order, OrderService, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';

/**
 * R2 快递单：学生确认快递已到校（第一程完成）。
 * 「发跑腿代取」走 Task 9 两步式 errand 链路（addItemToOrder + campusSetErrandInfo），天然复用。
 * 归属校验：customer.user.id 与 ctx.activeUserId 同为 User 表主键，直接可比。
 */
@Injectable()
export class R2MarkService {
    constructor(private connection: TransactionalConnection, private orderService: OrderService) {}

    /** R2: 学生确认快递已到校 → leg1Status='arrived_gate' + handoverAt */
    async markArrived(ctx: RequestContext, orderId: ID) {
        if (!ctx.activeUserId) throw new ForbiddenError();
        const order = await this.orderService.findOne(ctx, orderId as any, ['customer', 'customer.user'] as any);
        if (!order) throw new UserInputError('订单不存在');
        if ((order as any).customer?.user?.id !== ctx.activeUserId) throw new ForbiddenError();
        if ((order.customFields as any)?.fulfillmentRoute !== 'R2') {
            throw new UserInputError('仅 R2 快递单支持到校确认');
        }
        const leg1 = (order.customFields as any)?.leg1Status as string | null;
        if (leg1 === 'arrived_gate') return { leg1Status: 'arrived_gate' }; // 幂等：不重复写 handoverAt
        if (leg1 != null && leg1 !== 'preparing') throw new UserInputError('当前状态不支持到校确认');
        await this.connection.getRepository(ctx, Order).update(order.id, {
            customFields: { leg1Status: 'arrived_gate', handoverAt: new Date() },
        } as any);
        return { leg1Status: 'arrived_gate' };
    }
}
