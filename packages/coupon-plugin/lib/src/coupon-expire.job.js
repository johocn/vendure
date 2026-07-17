"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expireCouponsTask = void 0;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const coupon_service_1 = require("./coupon.service");
/**
 * 每小时扫描过期未使用的券码并标记为 expired。
 *
 * 由 DefaultSchedulerPlugin 在 worker 进程按 cron 周期执行；
 * 多实例下通过 SchedulerStrategy 锁机制保证 only-once；进程重启不丢任务。
 * 需在 plugin.ts 的 configuration 中 push 到 config.schedulerOptions.tasks。
 */
exports.expireCouponsTask = new core_1.ScheduledTask({
    id: 'coupon-expire-unused-codes',
    description: 'Mark unused coupon codes expired when their coupon endAt has passed',
    schedule: '0 * * * *',
    timeout: 5 * 60 * 1000,
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        var _a;
        const channelService = injector.get(core_1.ChannelService);
        const couponService = injector.get(coupon_service_1.CouponService);
        const channels = await channelService.findAll(scheduledContext);
        let totalExpired = 0;
        for (const channel of channels.items) {
            const ctx = new core_1.RequestContext({
                apiType: 'admin',
                channel,
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
            });
            try {
                const count = await couponService.expireCoupons(ctx);
                totalExpired += count;
            }
            catch (e) {
                core_1.Logger.error(`Failed to expire coupon codes for channel ${channel.id}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
            }
        }
        if (totalExpired > 0) {
            core_1.Logger.info(`Expired ${totalExpired} coupon codes across channels`, constants_1.loggerCtx);
        }
        return { totalExpired };
    },
});
//# sourceMappingURL=coupon-expire.job.js.map