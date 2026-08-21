"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preSaleStatusTask = void 0;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const pre_sale_activity_entity_1 = require("./pre-sale-activity.entity");
/**
 * 预售活动状态转换 ScheduledTask。
 * 使用 Vendure 内置 ScheduledTask（v3.3+），由 DefaultSchedulerPlugin 在 worker 进程周期执行。
 * schedule `* * * * *` = 每分钟一次。
 */
exports.preSaleStatusTask = new core_1.ScheduledTask({
    id: 'pre-sale-status-transition',
    description: 'Activate upcoming and end expired pre-sale activities',
    schedule: '* * * * *',
    timeout: 30 * 1000,
    preventOverlap: true,
    async execute({ injector }) {
        const connection = injector.get(core_1.TransactionalConnection);
        const repo = connection.rawConnection.getRepository(pre_sale_activity_entity_1.PreSaleActivity);
        const now = new Date();
        const toActivate = await repo
            .createQueryBuilder('psa')
            .where('psa.status = :status', { status: 'upcoming' })
            .andWhere('psa.startAt <= :now', { now })
            .getMany();
        for (const activity of toActivate) {
            activity.status = 'active';
            await repo.save(activity);
            core_1.Logger.info(`PreSaleActivity ${activity.id} activated`, constants_1.loggerCtx);
        }
        const toEnd = await repo
            .createQueryBuilder('psa')
            .where('psa.status IN (:...statuses)', { statuses: ['active', 'delivered'] })
            .andWhere('psa.endAt <= :now', { now })
            .getMany();
        for (const activity of toEnd) {
            activity.status = 'ended';
            await repo.save(activity);
            core_1.Logger.info(`PreSaleActivity ${activity.id} ended`, constants_1.loggerCtx);
        }
        return {
            activated: toActivate.length,
            ended: toEnd.length,
        };
    },
});
//# sourceMappingURL=pre-sale.job.js.map