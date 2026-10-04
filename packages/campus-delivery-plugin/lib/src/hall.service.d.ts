import { Order, RequestContext, TransactionalConnection } from '@vendure/core';
/**
 * 入厅服务：跑腿单（orderKind='errand'）或路线 R1/R3 的订单在支付后自动进入抢单大厅。
 */
export declare class HallService {
    private connection;
    constructor(connection: TransactionalConnection);
    onOrderPlaced(ctx: RequestContext, order: Order): Promise<void>;
}
