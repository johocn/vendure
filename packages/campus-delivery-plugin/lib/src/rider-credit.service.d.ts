import { RequestContext, TransactionalConnection } from '@vendure/core';
export declare const CREDIT_COMPLETE = 2;
export declare const CREDIT_REJECT = -5;
export declare const CREDIT_TIMEOUT = -10;
export declare const CREDIT_LIMIT = 60;
export declare class RiderCreditService {
    private connection;
    constructor(connection: TransactionalConnection);
    /** 加减分 + 流水。下限 0。
     * 并发安全：单条 UPDATE 原子读改写（GREATEST 夹紧），避免并发 adjust 互相覆盖丢分。
     * 列名为 customFields 物理列（riderCredit → customFieldsRidercredit）。 */
    adjust(ctx: RequestContext, customerId: number, delta: number, reason: string, orderId?: number): Promise<number>;
}
