"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productStatsTask = void 0;
// d:\zhao\vendure\packages\operations-plugin\src\product-stats.task.ts
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const product_stats_service_1 = require("./product-stats.service");
/**
 * @description
 * 每日 03:05 全量重算商品展示销量 / 可得积分。
 * 负责订单驱动的销量收敛（新订单带来的销量变化最多 T+1 生效）。
 *
 * 由 DefaultSchedulerPlugin 在 worker 进程执行（生产必须常驻 `vendure-worker`）。
 * 后台手改与变体价改动的即时生效由 ProductStatsSubscriber 承担。
 */
exports.productStatsTask = new core_1.ScheduledTask({
    id: 'operations-product-stats',
    description: 'Recompute Product.salesCount / pointsReward custom fields',
    schedule: '5 3 * * *',
    timeout: 600000,
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        const productStatsService = injector.get(product_stats_service_1.ProductStatsService);
        const updated = await productStatsService.recomputeAll(scheduledContext);
        core_1.Logger.info(`Product stats recompute: updated=${updated}`, constants_1.loggerCtx);
        return { updated };
    },
});
