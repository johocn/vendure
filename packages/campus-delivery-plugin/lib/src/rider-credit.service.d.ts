import { RequestContext, TransactionalConnection } from '@vendure/core';
export declare const CREDIT_COMPLETE = 2;
export declare const CREDIT_REJECT = -5;
export declare const CREDIT_TIMEOUT = -10;
export declare const CREDIT_LIMIT = 60;
export declare class RiderCreditService {
    private connection;
    constructor(connection: TransactionalConnection);
    /** 加减分 + 流水。下限 0。
     * 读取在 rawConnection.transaction 内直读 customFields.riderCredit（与 grab 事务模式一致），更新/流水走 ctx 仓储。 */
    adjust(ctx: RequestContext, customerId: number, delta: number, reason: string, orderId?: number): Promise<number>;
}
