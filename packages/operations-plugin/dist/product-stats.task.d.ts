import { ScheduledTask } from '@vendure/core';
/**
 * @description
 * 每日 03:05 全量重算商品展示销量 / 可得积分。
 * 负责订单驱动的销量收敛（新订单带来的销量变化最多 T+1 生效）。
 *
 * 由 DefaultSchedulerPlugin 在 worker 进程执行（生产必须常驻 `vendure-worker`）。
 * 后台手改与变体价改动的即时生效由 ProductStatsSubscriber 承担。
 */
export declare const productStatsTask: ScheduledTask<Record<string, any>>;
