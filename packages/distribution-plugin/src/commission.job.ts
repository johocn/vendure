import { ChannelService, Logger, RequestContext, ScheduledTask } from '@vendure/core';

import { CommissionService } from './commission.service';
import { loggerCtx } from './constants';

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
export const settleCommissionsTask = new ScheduledTask({
    id: 'distribution-settle-commissions',
    description: 'Settle pending distribution commissions for all enabled channels',
    schedule: '0 0 * * *',
    timeout: 5 * 60 * 1000,
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        const channelService = injector.get(ChannelService);
        const commissionService = injector.get(CommissionService);

        const channels = await channelService.findAll(scheduledContext);
        let totalSettled = 0;
        for (const channel of channels.items) {
            if (!(channel as any).customFields?.distributionEnabled) {
                continue;
            }
            const ctx = new RequestContext({
                apiType: 'admin',
                channel,
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
            });
            try {
                const count = await commissionService.settlePendingCommissions(ctx);
                totalSettled += count;
                Logger.info(`Settled ${count} pending commissions for channel ${channel.id}`, loggerCtx);
            } catch (e: any) {
                Logger.error(`Failed to settle commissions for channel ${channel.id}: ${e.message}`, loggerCtx);
            }
        }

        return { totalSettled };
    },
});
