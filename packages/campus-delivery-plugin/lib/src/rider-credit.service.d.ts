import { RequestContext, TransactionalConnection } from '@vendure/core';
export declare const CREDIT_COMPLETE = 2;
export declare const CREDIT_REJECT = -5;
export declare const CREDIT_TIMEOUT = -10;
export declare const CREDIT_LIMIT = 60;
/** 自动恢复周期：7 天没超时扣分 +5 分，封顶 100 */
export declare const CREDIT_RECOVERY_DAYS = 7;
export declare const CREDIT_RECOVERY_DELTA = 5;
export declare const CREDIT_RECOVERY_CAP = 100;
export declare class RiderCreditService {
    private connection;
    constructor(connection: TransactionalConnection);
    /** 加减分 + 流水。下限 0。
     * 并发安全：单条 UPDATE 原子读改写（GREATEST 夹紧），避免并发 adjust 互相覆盖丢分。
     * 列名为 customFields 物理列（riderCredit → customFieldsRidercredit）。 */
    adjust(ctx: RequestContext, customerId: number, delta: number, reason: string, orderId?: number): Promise<number>;
    /** 骑手信用自动恢复：7 天没 timeout 扣分且 7 天内未恢复过的骑手 credit<100 时 +5 分。
     *  每轮 dispatch sweep 每 channel 扫一次，每轮最多恢复 RECOVERY_LIMIT 人防长事务。
     *  去重：同一骑手 7 天内最多恢复一次（否则 sweep 每分钟一轮会把信用分一路刷回 100）。
     *  并发安全：每个 customerId 单独 adjust 原子 UPDATE + 流水。
     *  注意：rider_credit_log 物理列是带引号的 camelCase（"customerId"/"channelId"），
     *  原生 SQL 内必须加双引号，否则 PG 折叠成小写报 column "customerid" does not exist。 */
    sweepRecovery(ctx: RequestContext): Promise<number>;
}
