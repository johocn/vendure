import { ScheduledTask } from '@vendure/core';
/**
 * 每日凌晨 00:00 触发的佣金结算 ScheduledTask。
 *
 * 使用 Vendure 内置 ScheduledTask（v3.3+）替代原 setTimeout(24h) 一次性调度：
 * - 由 DefaultSchedulerPlugin 在 worker 进程按 cron 周期执行
 * - 多实例下通过 SchedulerStrategy 锁机制保证 only-once
 * - 进程重启不丢任务
 *
 * 需在 plugin.ts 的 configuration 中 push 到 config.schedulerOptions.tasks。
 */
export declare const settleCommissionsTask: ScheduledTask<Record<string, any>>;
