"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pointsOrderExpiryTask = void 0;
// 待支付积分订单超时关单：跨渠道分组扫描 → 按渠道建 ctx → 逐单原子取消（退分 + 回补库存）。
// 模式与 cjk-plugin reservation-expiry.task 一致（DefaultSchedulerPlugin 在 worker 周期执行）。
const core_1 = require("@vendure/core");
const points_order_entity_1 = require("./points-order.entity");
const points_mall_service_1 = require("./points-mall.service");
const constants_1 = require("./constants");
const loggerCtx = 'PointsOrderExpiryTask';
exports.pointsOrderExpiryTask = new core_1.ScheduledTask({
    id: constants_1.POINTS_ORDER_EXPIRY_TASK_ID,
    description: 'Cancel expired pending_payment points orders (refund points, restore stock)',
    schedule: cron => cron.every(1).minutes(),
    timeout: 60 * 1000,
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        var _a, _b;
        const connection = injector.get(core_1.TransactionalConnection);
        const requestContextService = injector.get(core_1.RequestContextService);
        const svc = injector.get(points_mall_service_1.PointsMallService);
        let options = {};
        try {
            options = (_a = injector.get(constants_1.POINTS_MALL_PLUGIN_OPTIONS)) !== null && _a !== void 0 ? _a : {};
        }
        catch (_c) {
            // 未注册 options 用默认 30 分钟
        }
        if (options.pointsOrderTimeoutMinutes === 0)
            return { cancelled: 0, skipped: true };
        const timeoutMinutes = Math.max(1, Number((_b = options.pointsOrderTimeoutMinutes) !== null && _b !== void 0 ? _b : 30));
        const before = new Date(Date.now() - timeoutMinutes * 60 * 1000);
        const groups = await connection.rawConnection
            .getRepository(points_order_entity_1.PointsOrder)
            .createQueryBuilder('po')
            .select('po."channelId"', 'cid')
            .where('po.status = :status', { status: 'pending_payment' })
            .andWhere('po."createdAt" < :before', { before })
            .groupBy('po."channelId"')
            .getRawMany();
        const channelRepo = connection.rawConnection.getRepository(core_1.Channel);
        let cancelled = 0;
        for (const g of groups) {
            const channel = g.cid ? await channelRepo.findOne({ where: { id: g.cid } }) : null;
            const ctx = channel
                ? await requestContextService.create({ apiType: 'admin', channelOrToken: channel })
                : scheduledContext;
            cancelled += await svc.cancelExpiredOrders(ctx, before);
        }
        if (cancelled) {
            core_1.Logger.info(`Points order expiry: cancelled ${cancelled} order(s) older than ${timeoutMinutes}m`, loggerCtx);
        }
        return { cancelled };
    },
});
//# sourceMappingURL=points-order-expiry.task.js.map