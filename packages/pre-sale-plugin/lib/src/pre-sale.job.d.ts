import { ScheduledTask } from '@vendure/core';
/**
 * 预售活动状态转换 ScheduledTask。
 * 使用 Vendure 内置 ScheduledTask（v3.3+），由 DefaultSchedulerPlugin 在 worker 进程周期执行。
 * schedule `* * * * *` = 每分钟一次。
 */
export declare const preSaleStatusTask: ScheduledTask<Record<string, any>>;
