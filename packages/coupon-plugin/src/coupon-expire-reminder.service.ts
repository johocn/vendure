import { Injectable } from '@nestjs/common';
import { EventBus, LanguageCode, Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import { Channel } from '@vendure/core';

import { CustomerCoupon } from './customer-coupon.entity';
import { CouponTemplate } from './coupon-template.entity';
import { localizeText } from './localize';
import { CouponExpireRemindEvent, CouponExpireStage } from './coupon-expire-reminder.events';

const DAY_MS = 24 * 60 * 60 * 1000;
const loggerCtx = 'CouponExpireReminderService';

/**
 * 距过期的提醒阶段（纯函数，SSR/任务双端一致）：
 *  - 已过期（t<=0）或距到期 > 3 天 → null（不提醒）；
 *  - <= 1 天 → '1d'；<= 3 天 → '3d'（PRD FR-A2：到期前 3 天 / 1 天各提醒一次）。
 */
export function expireStage(expiredAt: Date, now: Date): CouponExpireStage | null {
    const t = expiredAt.getTime() - now.getTime();
    if (t <= 0) return null;
    if (t <= DAY_MS) return '1d';
    if (t <= 3 * DAY_MS) return '3d';
    return null;
}

/** 渠道扫描行（getRawMany 裸行） */
interface ExpireScanRow {
    id: number;
    customerId: number;
    code: string;
    expiredAt: Date | string;
    templateId: number;
    name: string | null;
}

/**
 * 券过期提醒扫描（FR-A2）：
 * 周期扫描各渠道 status∈(UNUSED,RETURNED) 且 expiredAt 落入 3 天 / 1 天窗口的领券记录，
 * 逐条发布 CouponExpireRemindEvent；触达通道与 R4 防骚扰在 notification-plugin 订阅侧统一处理
 * （重复发布由订阅侧 7 天去重兜底，扫描幂等可重入）。
 */
@Injectable()
export class CouponExpireReminderService {
    constructor(
        private connection: TransactionalConnection,
        private eventBus: EventBus,
    ) {}

    /** 全渠道扫描（定时环境无请求 ctx：列全部渠道后逐渠道建 admin ctx） */
    async remindAllChannels(): Promise<{ channels: number; scanned: number; published: number }> {
        const channels = await this.connection.rawConnection.getRepository(Channel).find();
        let scanned = 0;
        let published = 0;
        for (const channel of channels) {
            const ctx = new RequestContext({
                apiType: 'admin',
                channel: channel as any,
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
            });
            try {
                const r = await this.remindChannel(ctx);
                scanned += r.scanned;
                published += r.published;
            } catch (e: any) {
                Logger.error(`remind channel ${channel.id} failed: ${e?.message ?? e}`, loggerCtx);
            }
        }
        if (published > 0) {
            Logger.info(`Coupon expire reminder: scanned ${scanned}, published ${published} across ${channels.length} channels`, loggerCtx);
        }
        return { channels: channels.length, scanned, published };
    }

    /** 单渠道扫描并发布提醒事件：一次 3 天窗口扫描，stage（3d/1d）按剩余时间逐行判定 */
    async remindChannel(ctx: RequestContext): Promise<{ scanned: number; published: number }> {
        const now = new Date();
        const rows = await this.scanChannel(ctx, now, 3);
        let published = 0;
        for (const row of rows) {
            const stage = expireStage(new Date(row.expiredAt), now);
            if (!stage) continue;
            this.eventBus.publish(
                new CouponExpireRemindEvent(ctx, {
                    customerId: Number(row.customerId),
                    templateId: Number(row.templateId),
                    templateName: localizeText((row.name ?? undefined) as any, ctx.languageCode ?? LanguageCode.zh_Hans),
                    couponCode: row.code,
                    expiresAt: new Date(row.expiredAt),
                    stage,
                }),
            );
            published++;
        }
        return { scanned: rows.length, published };
    }

    /** 本渠道 status∈(UNUSED,RETURNED)、expiredAt∈(now, now+days] 的领券记录（createdAt 过滤下推 SQL 层同法：窗口条件全下推） */
    private async scanChannel(ctx: RequestContext, now: Date, days: number): Promise<ExpireScanRow[]> {
        const horizon = new Date(now.getTime() + days * DAY_MS);
        return this.connection
            .getRepository(ctx, CustomerCoupon)
            .createQueryBuilder('cc')
            .innerJoin(CouponTemplate, 'tpl', 'tpl.id = cc.templateId')
            .innerJoin('tpl.channels', 'ch', 'ch.id = :channelId', { channelId: ctx.channelId as number })
            .where('cc.status IN (:...statuses)', { statuses: ['UNUSED', 'RETURNED'] })
            .andWhere('cc.expiredAt IS NOT NULL')
            .andWhere('cc.expiredAt > :now', { now })
            .andWhere('cc.expiredAt <= :horizon', { horizon })
            .select([
                'cc.id AS id',
                'cc.customerId AS customerId',
                'cc.code AS code',
                'cc.expiredAt AS expiredAt',
                'tpl.id AS templateId',
                'tpl.name AS name',
            ])
            .getRawMany();
    }
}
