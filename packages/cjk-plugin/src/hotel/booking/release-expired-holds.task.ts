// 过期锁房单释放：每小时把过期 hold 置 released（remaining 统计本就不计过期 hold，
// 此任务只做统计面清理与审计状态收敛）。锁房表按 variantId 全局唯一天然租户隔离，无需按渠道分组。
import { ScheduledTask } from '@vendure/core';
import { HotelInventoryService } from './hotel-inventory.service';

export const RELEASE_EXPIRED_HOTEL_HOLDS_TASK_ID = 'release-expired-hotel-holds';

export const releaseExpiredHotelHoldsTask = new ScheduledTask({
    id: RELEASE_EXPIRED_HOTEL_HOLDS_TASK_ID,
    description: 'Release expired hotel booking hold locks (15min TTL)',
    schedule: cron => cron.every(1).hours(),
    timeout: 60 * 1000,
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        const service = injector.get(HotelInventoryService);
        const released = await service.expireStaleHolds(scheduledContext);
        return { released };
    },
});
