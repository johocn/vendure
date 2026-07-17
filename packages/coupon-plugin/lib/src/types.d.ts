export interface CouponPluginOptions {
    /** Cron schedule for expiring unused coupon codes. Defaults to every hour. */
    expireTaskSchedule?: string;
}
