import { ScheduledTask } from '@vendure/core';
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
export declare const pointsExpireTask: ScheduledTask<Record<string, any>>;
