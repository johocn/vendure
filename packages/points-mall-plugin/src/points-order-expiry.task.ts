// 待支付积分订单超时关单：跨渠道分组扫描 → 按渠道建 ctx → 逐单原子取消（退分 + 回补库存）。
// 模式与 cjk-plugin reservation-expiry.task 一致（DefaultSchedulerPlugin 在 worker 周期执行）。
import { Channel, Logger, RequestContextService, ScheduledTask, TransactionalConnection } from '@vendure/core';
import { PointsOrder } from './points-order.entity';
import { PointsMallService } from './points-mall.service';
import { POINTS_MALL_PLUGIN_OPTIONS, POINTS_ORDER_EXPIRY_TASK_ID } from './constants';

const loggerCtx = 'PointsOrderExpiryTask';

export const pointsOrderExpiryTask = new ScheduledTask({
    id: POINTS_ORDER_EXPIRY_TASK_ID,
    description: 'Cancel expired pending_payment points orders (refund points, restore stock)',
    schedule: cron => cron.every(1).minutes(),
    timeout: 60 * 1000,
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        const connection = injector.get(TransactionalConnection);
        const requestContextService = injector.get(RequestContextService);
        const svc = injector.get(PointsMallService);
        let options: { pointsOrderTimeoutMinutes?: number } = {};
        try {
            options = injector.get(POINTS_MALL_PLUGIN_OPTIONS) ?? {};
        } catch {
            // 未注册 options 用默认 30 分钟
        }
        if (options.pointsOrderTimeoutMinutes === 0) return { cancelled: 0, skipped: true };
        const timeoutMinutes = Math.max(1, Number(options.pointsOrderTimeoutMinutes ?? 30));
        const before = new Date(Date.now() - timeoutMinutes * 60 * 1000);

        const groups = await connection.rawConnection
            .getRepository(PointsOrder)
            .createQueryBuilder('po')
            .select('po."channelId"', 'cid')
            .where('po.status = :status', { status: 'pending_payment' })
            .andWhere('po."createdAt" < :before', { before })
            .groupBy('po."channelId"')
            .getRawMany<{ cid: number | null }>();
        const channelRepo = connection.rawConnection.getRepository(Channel);
        let cancelled = 0;
        for (const g of groups) {
            const channel = g.cid ? await channelRepo.findOne({ where: { id: g.cid } }) : null;
            const ctx = channel
                ? await requestContextService.create({ apiType: 'admin', channelOrToken: channel })
                : scheduledContext;
            cancelled += await svc.cancelExpiredOrders(ctx, before);
        }
        if (cancelled) {
            Logger.info(`Points order expiry: cancelled ${cancelled} order(s) older than ${timeoutMinutes}m`, loggerCtx);
        }
        return { cancelled };
    },
});
