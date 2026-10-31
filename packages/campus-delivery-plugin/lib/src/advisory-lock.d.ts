import { TransactionalConnection } from '@vendure/core';
/**
 * 在 PG 会话级咨询锁内执行 fn（与 ops-check / dispatch-job 等既有任务同模式）。
 *
 * - 拿不到锁说明其他实例正在执行，直接返回 undefined，调用方应跳过本轮；
 * - fn 抛错时异常向上抛出（由 PeriodicFallback 隔离），unlock / release 均在 finally 中完成；
 * - 本地 sqlite 不支持 advisory lock：锁查询失败时记 warn 并直接执行 fn，保证单进程开发可用
 *   （现有任务均未做 sqlite 兼容，这里保持同一口径）。
 */
export declare function withAdvisoryLock<T>(connection: TransactionalConnection, key: string, fn: () => Promise<T>, loggerCtx?: string): Promise<T | undefined>;
