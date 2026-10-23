import { TransactionalConnection } from '@vendure/core';
/** 退款串行化锁键：商家拒单 / T4 无人接 / 运营异常处置 / 改址差额结清共用，按订单维度互斥 */
export declare const refundLockKey: (orderId: number | string) => string;
export type RefundLockResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
};
/**
 * 在订单级咨询锁内执行退款复合动作（查已退总额 → 退差额 → 落记录）。
 * ok=false 表示该订单已有另一路退款在处理，调用方应提示重试或本轮跳过。
 * 锁由同一 QueryRunner 持有/释放，避免连接池换连接导致锁泄漏。
 */
export declare function withRefundLock<T>(connection: TransactionalConnection, orderId: number | string, fn: () => Promise<T>): Promise<RefundLockResult<T>>;
