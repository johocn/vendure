"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupBuyCheckTask = void 0;
const core_1 = require("@vendure/core");
const group_buy_job_1 = require("./group-buy.job");
// 使用 Vendure ScheduledTask 替代原 setTimeout 链式递归，
// 由 SchedulerStrategy 统一调度，避免多实例并发重复执行。
exports.groupBuyCheckTask = new core_1.ScheduledTask({
    id: 'group-buy-check',
    description: 'Periodically expires group buy activities and refunds failed orders',
    schedule: cron => cron.everyMinute(),
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        return injector.get(group_buy_job_1.GroupBuyJob).runCheck(scheduledContext);
    },
});
//# sourceMappingURL=group-buy-scheduled-task.js.map