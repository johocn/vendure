"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pointsExpireTask = void 0;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const member_level_service_1 = require("./member-level.service");
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
exports.pointsExpireTask = new core_1.ScheduledTask({
    id: 'member-points-expire',
    description: 'Expire earned points past their expiresAt',
    schedule: cron => cron.every(5).minutes(),
    timeout: 30 * 1000,
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        var _a;
        try {
            const service = injector.get(member_level_service_1.MemberLevelService);
            const count = await service.expireEarnedPoints(scheduledContext);
            if (count > 0) {
                core_1.Logger.info(`Points expiry job: expired ${count} records`, constants_1.loggerCtx);
            }
        }
        catch (e) {
            core_1.Logger.warn(`Points expiry job error: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
        }
    },
});
//# sourceMappingURL=points-expire.job.js.map