"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settleCommissionsTask = void 0;
const core_1 = require("@vendure/core");
const commission_service_1 = require("./commission.service");
const constants_1 = require("./constants");
/**
 * 每日凌晨 00:00 触发的佣金结算 ScheduledTask。
 *
 * 使用 Vendure 内置 ScheduledTask（v3.3+）替代原 setTimeout(24h) 一次性调度：
 * - 由 DefaultSchedulerPlugin 在 worker 进程按 cron 周期执行
 * - 多实例下通过 SchedulerStrategy 锁机制保证 only-once
 * - 进程重启不丢任务
 *
 * 需在 plugin.ts 的 configuration 中 push 到 config.schedulerOptions.tasks。
 */
exports.settleCommissionsTask = new core_1.ScheduledTask({
    id: 'distribution-settle-commissions',
    description: 'Settle pending distribution commissions for all enabled channels',
    schedule: '0 0 * * *',
    timeout: 5 * 60 * 1000,
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        var _a;
        const channelService = injector.get(core_1.ChannelService);
        const commissionService = injector.get(commission_service_1.CommissionService);
        const channels = await channelService.findAll(scheduledContext);
        let totalSettled = 0;
        for (const channel of channels.items) {
            if (!((_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.distributionEnabled)) {
                continue;
            }
            const ctx = new core_1.RequestContext({
                apiType: 'admin',
                channel,
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
            });
            try {
                const count = await commissionService.settlePendingCommissions(ctx);
                totalSettled += count;
                core_1.Logger.info(`Settled ${count} pending commissions for channel ${channel.id}`, constants_1.loggerCtx);
            }
            catch (e) {
                core_1.Logger.error(`Failed to settle commissions for channel ${channel.id}: ${e.message}`, constants_1.loggerCtx);
            }
        }
        return { totalSettled };
    },
});
//# sourceMappingURL=commission.job.js.map