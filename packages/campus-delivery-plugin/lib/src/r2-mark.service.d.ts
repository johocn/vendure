import { ID, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
/**
 * R2 快递单：学生确认快递已到校（第一程完成）。
 * 「发跑腿代取」走 Task 9 两步式 errand 链路（addItemToOrder + campusSetErrandInfo），天然复用。
 * 归属校验：customer.user.id 与 ctx.activeUserId 同为 User 表主键，直接可比。
 */
export declare class R2MarkService {
    private connection;
    private orderService;
    constructor(connection: TransactionalConnection, orderService: OrderService);
    /** R2: 学生确认快递已到校 → leg1Status='arrived_gate' + handoverAt */
    markArrived(ctx: RequestContext, orderId: ID): Promise<{
        leg1Status: string;
    }>;
}
