import { ScheduledTask } from '@vendure/core';
/**
 * 每小时扫描过期未使用的券码并标记为 expired。
 *
 * 由 DefaultSchedulerPlugin 在 worker 进程按 cron 周期执行；
 * 多实例下通过 SchedulerStrategy 锁机制保证 only-once；进程重启不丢任务。
 * 需在 plugin.ts 的 configuration 中 push 到 config.schedulerOptions.tasks。
 */
export declare const expireCouponsTask: ScheduledTask<Record<string, any>>;
