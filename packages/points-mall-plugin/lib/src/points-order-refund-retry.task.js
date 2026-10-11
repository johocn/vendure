"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pointsOrderRefundRetryTask = void 0;
// 积分订单微信退款重试：跨渠道分组扫描 → 按渠道建 ctx → 逐渠道重试 failed / 卡 refunding 的支付行。
// 模式与 points-order-expiry.task 一致；退避策略参照 after-sales-timeout.job（指数退避）。
const core_1 = require("@vendure/core");
const points_order_payment_entity_1 = require("./points-order-payment.entity");
const points_mall_service_1 = require("./points-mall.service");
const constants_1 = require("./constants");
const loggerCtx = 'PointsOrderRefundRetryTask';
const MAX_ATTEMPTS = 8;
const STUCK_REFUNDING_MS = 10 * 60 * 1000;
exports.pointsOrderRefundRetryTask = new core_1.ScheduledTask({
    id: constants_1.POINTS_ORDER_REFUND_RETRY_TASK_ID,
    description: 'Retry failed/stuck wechat refunds for cancelled points orders',
    schedule: cron => cron.every(5).minutes(),
    timeout: 120 * 1000,
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        var _a;
        let options = {};
        try {
            options = (_a = injector.get(constants_1.POINTS_MALL_PLUGIN_OPTIONS)) !== null && _a !== void 0 ? _a : {};
        }
        catch (_b) {
            // 未注册 options 用默认（启用）
        }
        if (options.pointsRefundRetryEnabled === false)
            return { refunded: 0, failed: 0, skipped: true };
        const connection = injector.get(core_1.TransactionalConnection);
        const requestContextService = injector.get(core_1.RequestContextService);
        const svc = injector.get(points_mall_service_1.PointsMallService);
        const stuckBefore = new Date(Date.now() - STUCK_REFUNDING_MS);
        const groups = await connection.rawConnection
            .getRepository(points_order_payment_entity_1.PointsOrderPayment)
            .createQueryBuilder('p')
            .select('p."channelId"', 'cid')
            .where("(p.\"refundStatus\" = 'failed' OR (p.\"refundStatus\" = 'refunding' AND p.\"updatedAt\" < :stuckBefore))", { stuckBefore })
            .andWhere('p."refundAttempts" < :max', { max: MAX_ATTEMPTS })
            .groupBy('p."channelId"')
            .getRawMany();
        const channelRepo = connection.rawConnection.getRepository(core_1.Channel);
        let refunded = 0;
        let failed = 0;
        for (const g of groups) {
            const channel = g.cid ? await channelRepo.findOne({ where: { id: g.cid } }) : null;
            const ctx = channel
                ? await requestContextService.create({ apiType: 'admin', channelOrToken: channel })
                : scheduledContext;
            const r = await svc.retryPointsOrderRefunds(ctx);
            refunded += r.refunded;
            failed += r.failed;
        }
        if (refunded || failed) {
            core_1.Logger.info(`Points order refund retry: refunded=${refunded} failed=${failed}`, loggerCtx);
        }
        return { refunded, failed };
    },
});
//# sourceMappingURL=points-order-refund-retry.task.js.map