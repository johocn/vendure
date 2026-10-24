import { TransactionalConnection } from '@vendure/core';
/** 退款串行化锁键：商家拒单 / T4 无人接 / 运营异常处置 / 改址差额结清共用，按订单维度互斥 */
export declare const refundLockKey: (orderId: number | string) => string;
/** 改址串行化锁键：同一订单的并发改址必须串行，避免重复写台账/重复计差额 */
export declare const addressLockKey: (orderId: number | string) => string;
export type RefundLockResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
};
/**
 * 在订单级咨询锁内执行复合动作（查已退总额 → 退差额 → 落记录）。
 * ok=false 表示该订单已有另一路操作在处理，调用方应提示重试或本轮跳过。
 * 锁由同一 QueryRunner 持有/释放，避免连接池换连接导致锁泄漏。
 */
export declare function withAdvisoryLock<T>(connection: TransactionalConnection, lockKey: string, fn: () => Promise<T>): Promise<RefundLockResult<T>>;
export declare function withRefundLock<T>(connection: TransactionalConnection, orderId: number | string, fn: () => Promise<T>): Promise<RefundLockResult<T>>;
/** 改址锁：同一订单的改址（含台账写入）串行化 */
export declare function withAddressLock<T>(connection: TransactionalConnection, orderId: number | string, fn: () => Promise<T>): Promise<RefundLockResult<T>>;
