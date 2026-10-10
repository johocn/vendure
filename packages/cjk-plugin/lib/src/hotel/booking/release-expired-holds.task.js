"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.releaseExpiredHotelHoldsTask = exports.RELEASE_EXPIRED_HOTEL_HOLDS_TASK_ID = void 0;
// 过期锁房单释放：每小时把过期 hold 置 released（remaining 统计本就不计过期 hold，
// 此任务只做统计面清理与审计状态收敛）。锁房表按 variantId 全局唯一天然租户隔离，无需按渠道分组。
const core_1 = require("@vendure/core");
const hotel_inventory_service_1 = require("./hotel-inventory.service");
exports.RELEASE_EXPIRED_HOTEL_HOLDS_TASK_ID = 'release-expired-hotel-holds';
exports.releaseExpiredHotelHoldsTask = new core_1.ScheduledTask({
    id: exports.RELEASE_EXPIRED_HOTEL_HOLDS_TASK_ID,
    description: 'Release expired hotel booking hold locks (15min TTL)',
    schedule: cron => cron.every(1).hours(),
    timeout: 60 * 1000,
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        const service = injector.get(hotel_inventory_service_1.HotelInventoryService);
        const released = await service.expireStaleHolds(scheduledContext);
        return { released };
    },
});
//# sourceMappingURL=release-expired-holds.task.js.map