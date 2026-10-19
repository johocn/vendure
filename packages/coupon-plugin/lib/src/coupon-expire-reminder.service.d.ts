import { EventBus, RequestContext, TransactionalConnection } from '@vendure/core';
import { CouponExpireStage } from './coupon-expire-reminder.events';
/**
 * 距过期的提醒阶段（纯函数，SSR/任务双端一致）：
 *  - 已过期（t<=0）或距到期 > 3 天 → null（不提醒）；
 *  - <= 1 天 → '1d'；<= 3 天 → '3d'（PRD FR-A2：到期前 3 天 / 1 天各提醒一次）。
 */
export declare function expireStage(expiredAt: Date, now: Date): CouponExpireStage | null;
/**
 * 券过期提醒扫描（FR-A2）：
 * 周期扫描各渠道 status∈(UNUSED,RETURNED) 且 expiredAt 落入 3 天 / 1 天窗口的领券记录，
 * 逐条发布 CouponExpireRemindEvent；触达通道与 R4 防骚扰在 notification-plugin 订阅侧统一处理
 * （重复发布由订阅侧 7 天去重兜底，扫描幂等可重入）。
 */
export declare class CouponExpireReminderService {
    private connection;
    private eventBus;
    constructor(connection: TransactionalConnection, eventBus: EventBus);
    /** 全渠道扫描（定时环境无请求 ctx：列全部渠道后逐渠道建 admin ctx） */
    remindAllChannels(): Promise<{
        channels: number;
        scanned: number;
        published: number;
    }>;
    /** 单渠道扫描并发布提醒事件：一次 3 天窗口扫描，stage（3d/1d）按剩余时间逐行判定 */
    remindChannel(ctx: RequestContext): Promise<{
        scanned: number;
        published: number;
    }>;
    /** 本渠道 status∈(UNUSED,RETURNED)、expiredAt∈(now, now+days] 的领券记录（createdAt 过滤下推 SQL 层同法：窗口条件全下推） */
    private scanChannel;
}
