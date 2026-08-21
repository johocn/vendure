import { Logger, ScheduledTask, TransactionalConnection } from '@vendure/core';

import { loggerCtx } from './constants';
import { PreSaleActivity } from './pre-sale-activity.entity';

/**
 * 预售活动状态转换 ScheduledTask。
 * 使用 Vendure 内置 ScheduledTask（v3.3+），由 DefaultSchedulerPlugin 在 worker 进程周期执行。
 * schedule `* * * * *` = 每分钟一次。
 */
export const preSaleStatusTask = new ScheduledTask({
    id: 'pre-sale-status-transition',
    description: 'Activate upcoming and end expired pre-sale activities',
    schedule: '* * * * *',
    timeout: 30 * 1000,
    preventOverlap: true,
    async execute({ injector }) {
        const connection = injector.get(TransactionalConnection);
        const repo = connection.rawConnection.getRepository(PreSaleActivity);
        const now = new Date();

        const toActivate = await repo
            .createQueryBuilder('psa')
            .where('psa.status = :status', { status: 'upcoming' })
            .andWhere('psa.startAt <= :now', { now })
            .getMany();

        for (const activity of toActivate) {
            activity.status = 'active';
            await repo.save(activity);
            Logger.info(`PreSaleActivity ${activity.id} activated`, loggerCtx);
        }

        const toEnd = await repo
            .createQueryBuilder('psa')
            .where('psa.status IN (:...statuses)', { statuses: ['active', 'delivered'] })
            .andWhere('psa.endAt <= :now', { now })
            .getMany();

        for (const activity of toEnd) {
            activity.status = 'ended';
            await repo.save(activity);
            Logger.info(`PreSaleActivity ${activity.id} ended`, loggerCtx);
        }

        return {
            activated: toActivate.length,
            ended: toEnd.length,
        };
    },
});