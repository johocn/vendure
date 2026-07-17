import { ChannelService, Logger, RequestContext, ScheduledTask } from '@vendure/core';

import { loggerCtx } from './constants';
import { CouponService } from './coupon.service';

/**
 * 每小时扫描过期未使用的券码并标记为 expired。
 *
 * 由 DefaultSchedulerPlugin 在 worker 进程按 cron 周期执行；
 * 多实例下通过 SchedulerStrategy 锁机制保证 only-once；进程重启不丢任务。
 * 需在 plugin.ts 的 configuration 中 push 到 config.schedulerOptions.tasks。
 */
export const expireCouponsTask = new ScheduledTask({
    id: 'coupon-expire-unused-codes',
    description: 'Mark unused coupon codes expired when their coupon endAt has passed',
    schedule: '0 * * * *',
    timeout: 5 * 60 * 1000,
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        const channelService = injector.get(ChannelService);
        const couponService = injector.get(CouponService);

        const channels = await channelService.findAll(scheduledContext);
        let totalExpired = 0;
        for (const channel of channels.items) {
            const ctx = new RequestContext({
                apiType: 'admin',
                channel,
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
            });
            try {
                const count = await couponService.expireCoupons(ctx);
                totalExpired += count;
            } catch (e: any) {
                Logger.error(
                    `Failed to expire coupon codes for channel ${channel.id}: ${e?.message ?? e}`,
                    loggerCtx,
                );
            }
        }
        if (totalExpired > 0) {
            Logger.info(`Expired ${totalExpired} coupon codes across channels`, loggerCtx);
        }
        return { totalExpired };
    },
});
