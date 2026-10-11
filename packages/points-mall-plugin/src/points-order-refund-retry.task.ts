// 积分订单微信退款重试：跨渠道分组扫描 → 按渠道建 ctx → 逐渠道重试 failed / 卡 refunding 的支付行。
// 模式与 points-order-expiry.task 一致；退避策略参照 after-sales-timeout.job（指数退避）。
import { Channel, Logger, RequestContextService, ScheduledTask, TransactionalConnection } from '@vendure/core';
import { PointsOrderPayment } from './points-order-payment.entity';
import { PointsMallService } from './points-mall.service';
import { POINTS_MALL_PLUGIN_OPTIONS, POINTS_ORDER_REFUND_RETRY_TASK_ID } from './constants';

const loggerCtx = 'PointsOrderRefundRetryTask';
const MAX_ATTEMPTS = 8;
const STUCK_REFUNDING_MS = 10 * 60 * 1000;

export const pointsOrderRefundRetryTask = new ScheduledTask({
    id: POINTS_ORDER_REFUND_RETRY_TASK_ID,
    description: 'Retry failed/stuck wechat refunds for cancelled points orders',
    schedule: cron => cron.every(5).minutes(),
    timeout: 120 * 1000,
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        let options: { pointsRefundRetryEnabled?: boolean } = {};
        try {
            options = injector.get(POINTS_MALL_PLUGIN_OPTIONS) ?? {};
        } catch {
            // 未注册 options 用默认（启用）
        }
        if (options.pointsRefundRetryEnabled === false) return { refunded: 0, failed: 0, processing: 0, skipped: true };
        const connection = injector.get(TransactionalConnection);
        const requestContextService = injector.get(RequestContextService);
        const svc = injector.get(PointsMallService);

        const stuckBefore = new Date(Date.now() - STUCK_REFUNDING_MS);
        const groups = await connection.rawConnection
            .getRepository(PointsOrderPayment)
            .createQueryBuilder('p')
            .select('p."channelId"', 'cid')
            .where(
                "(p.\"refundStatus\" = 'failed' OR (p.\"refundStatus\" = 'refunding' AND p.\"updatedAt\" < :stuckBefore))",
                { stuckBefore },
            )
            .andWhere('p."refundAttempts" < :max', { max: MAX_ATTEMPTS })
            .groupBy('p."channelId"')
            .getRawMany<{ cid: number | null }>();
        const channelRepo = connection.rawConnection.getRepository(Channel);
        let refunded = 0;
        let failed = 0;
        let processing = 0;
        for (const g of groups) {
            const channel = g.cid ? await channelRepo.findOne({ where: { id: g.cid } }) : null;
            const ctx = channel
                ? await requestContextService.create({ apiType: 'admin', channelOrToken: channel })
                : scheduledContext;
            const r = await svc.retryPointsOrderRefunds(ctx);
            refunded += r.refunded;
            failed += r.failed;
            processing += r.processing ?? 0;
        }
        if (refunded || failed || processing) {
            Logger.info(
                `Points order refund retry: refunded=${refunded} failed=${failed} processing=${processing}`,
                loggerCtx,
            );
        }
        return { refunded, failed, processing };
    },
});
