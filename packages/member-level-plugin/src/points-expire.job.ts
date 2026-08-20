import { Logger, RequestContext, ScheduledTask } from '@vendure/core';

import { loggerCtx } from './constants';
import { MemberLevelService } from './member-level.service';

/**
 * 积分过期清理 ScheduledTask。
 *
 * 使用 Vendure 内置 ScheduledTask（v3.3+）：
 * - 每 5 分钟扫描当前渠道 type=EARN 且 expiresAt 已过的积分明细
 * - 幂等扣减用户余额并写 EXPIRE 明细（remark=`earn_expired:<earnId>`）
 * - scheduledContext 为默认渠道 ctx；仅当 Channel.pointsExpireDays > 0 时才生效
 *
 * 需在 plugin.ts configuration 中 push 到 config.schedulerOptions.tasks。
 */
export const pointsExpireTask = new ScheduledTask({
    id: 'member-points-expire',
    description: 'Expire earned points past their expiresAt',
    schedule: cron => cron.every(5).minutes(),
    timeout: 30 * 1000,
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        try {
            const service = injector.get(MemberLevelService);
            const count = await service.expireEarnedPoints(scheduledContext as RequestContext);
            if (count > 0) {
                Logger.info(`Points expiry job: expired ${count} records`, loggerCtx);
            }
        } catch (e: any) {
            Logger.warn(`Points expiry job error: ${e?.message ?? e}`, loggerCtx);
        }
    },
});
