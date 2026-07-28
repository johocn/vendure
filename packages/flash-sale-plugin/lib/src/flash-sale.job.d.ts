import { ScheduledTask } from '@vendure/core';
/**
 * 秒杀活动状态转换 ScheduledTask。
 *
 * 使用 Vendure 内置 ScheduledTask（v3.3+）替代原 setInterval：
 * - 由 DefaultSchedulerPlugin 在 worker 进程按 cron 周期执行
 * - 多实例下通过 SchedulerStrategy 锁机制保证 only-once，避免多实例重复处理状态转换
 * - 进程重启不丢任务
 *
 * 需在 plugin.ts 的 configuration 中 push 到 config.schedulerOptions.tasks。
 *
 * schedule `* * * * *` = 每分钟一次（与原 setInterval(60s) 频率一致）。
 */
export declare const flashSaleStatusTask: ScheduledTask<Record<string, any>>;
