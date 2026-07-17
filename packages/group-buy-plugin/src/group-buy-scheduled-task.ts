import { ScheduledTask } from '@vendure/core';

import { GroupBuyJob } from './group-buy.job';

// 使用 Vendure ScheduledTask 替代原 setTimeout 链式递归，
// 由 SchedulerStrategy 统一调度，避免多实例并发重复执行。
export const groupBuyCheckTask = new ScheduledTask({
    id: 'group-buy-check',
    description: 'Periodically expires group buy activities and refunds failed orders',
    schedule: cron => cron.everyMinute(),
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        return injector.get(GroupBuyJob).runCheck(scheduledContext);
    },
});
