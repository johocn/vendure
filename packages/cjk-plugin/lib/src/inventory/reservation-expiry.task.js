"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.releaseExpiredReservationsTask = exports.RELEASE_EXPIRED_RESERVATIONS_TASK_ID = void 0;
// 预留单超时释放：Vendure 内置 ScheduledTask（v3.3+），由 DefaultSchedulerPlugin 在 worker 进程按 cron 执行。
// 选 1 分钟周期：释放时效 ≤1min，代价是每轮一次极轻量的分组扫描（只扫 PENDING_ALLOC 且有 expiresAt 的行）。
// 复用既有 tenantChannelId（存的是 channel.code）反查渠道，再按渠道建 ctx —— 多店铺各自 TTL 才能生效。
const core_1 = require("@vendure/core");
const stock_reservation_entity_1 = require("./stock-reservation.entity");
const stock_reservation_service_1 = require("./stock-reservation.service");
const loggerCtx = 'ReleaseExpiredReservationsTask';
exports.RELEASE_EXPIRED_RESERVATIONS_TASK_ID = 'release-expired-reservations';
exports.releaseExpiredReservationsTask = new core_1.ScheduledTask({
    id: exports.RELEASE_EXPIRED_RESERVATIONS_TASK_ID,
    description: 'Release expired PENDING_ALLOC stock reservations (per-channel TTL)',
    schedule: cron => cron.every(1).minutes(),
    timeout: 60 * 1000,
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        const connection = injector.get(core_1.TransactionalConnection);
        const requestContextService = injector.get(core_1.RequestContextService);
        const service = injector.get(stock_reservation_service_1.StockReservationService);
        // 先跨渠道取「有到期单」的渠道集合，避免为每个渠道都建 ctx 做全表扫描
        const candidates = await connection.rawConnection
            .getRepository(stock_reservation_entity_1.StockReservationEntity)
            .createQueryBuilder('r')
            .select('r.tenantChannelId', 'tenant')
            .where('r.status = :status', { status: 'PENDING_ALLOC' })
            .andWhere('r.expiresAt IS NOT NULL')
            .andWhere('r.expiresAt < :now', { now: new Date() })
            .groupBy('r.tenantChannelId')
            .getRawMany();
        const channelRepo = connection.rawConnection.getRepository(core_1.Channel);
        let released = 0;
        for (const c of candidates) {
            const code = c.tenant;
            const channel = code ? await channelRepo.findOne({ where: { code } }) : null;
            // 渠道查不到 / tenantChannelId 为 NULL：退回默认渠道 ctx（与 core ScheduledTask 口径一致）
            const ctx = channel
                ? await requestContextService.create({ apiType: 'admin', channelOrToken: channel })
                : scheduledContext;
            const r = await service.releaseExpired(ctx);
            released += r.released;
        }
        if (released) {
            core_1.Logger.info(`释放到期预留单 ${released} 条（涉及 ${candidates.length} 个渠道）`, loggerCtx);
        }
        return { channels: candidates.length, released };
    },
});
//# sourceMappingURL=reservation-expiry.task.js.map