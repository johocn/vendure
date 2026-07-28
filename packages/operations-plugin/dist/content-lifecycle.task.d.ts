import { ScheduledTask } from '@vendure/core';
/**
 * @description
 * ScheduledTask that runs every minute to auto-publish/unpublish ContentItems
 * based on their startAt/endAt fields.
 *
 * Uses Vendure's built-in ScheduledTask (v3.3+):
 * - Executed by DefaultSchedulerPlugin in worker process
 * - Multi-instance: only-once via DB lock
 * - Survives process restarts
 *
 * Reference: flash-sale-plugin/src/flash-sale.job.ts
 */
export declare const contentLifecycleTask: ScheduledTask<Record<string, any>>;
