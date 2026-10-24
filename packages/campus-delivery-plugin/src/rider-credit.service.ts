import { Injectable } from '@nestjs/common';
import { Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import { RiderCreditLog } from './rider-credit-log.entity';

export const CREDIT_COMPLETE = 2;
export const CREDIT_REJECT = -5;
export const CREDIT_TIMEOUT = -10;
export const CREDIT_LIMIT = 60;
/** 自动恢复周期：7 天没超时扣分 +5 分，封顶 100 */
export const CREDIT_RECOVERY_DAYS = 7;
export const CREDIT_RECOVERY_DELTA = 5;
export const CREDIT_RECOVERY_CAP = 100;
/** 单 channel 单轮恢复上限（防长事务） */
const RECOVERY_LIMIT = 200;

@Injectable()
export class RiderCreditService {
    constructor(private connection: TransactionalConnection) {}

    /** 加减分 + 流水。下限 0。
     * 并发安全：单条 UPDATE 原子读改写（GREATEST 夹紧），避免并发 adjust 互相覆盖丢分。
     * 列名为 customFields 物理列（riderCredit → customFieldsRidercredit）。 */
    async adjust(ctx: RequestContext, customerId: number, delta: number, reason: string, orderId?: number) {
        const clamp = delta > 0
            ? 'LEAST(' + CREDIT_RECOVERY_CAP + ', COALESCE("customFieldsRidercredit", 100) + $1)'
            : 'GREATEST(0, COALESCE("customFieldsRidercredit", 100) + $1)';
        const rows: any = await this.connection.rawConnection.query(
            'UPDATE "customer" SET "customFieldsRidercredit" = ' + clamp
            + ' WHERE id = $2 RETURNING "customFieldsRidercredit" AS credit',
            [delta, customerId],
        );
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        const next = Number(list?.[0]?.credit ?? (delta > 0 ? 100 + delta : 100));
        try {
            await this.connection.getRepository(ctx, RiderCreditLog).save({
                customerId, delta, reason, orderId: orderId ?? null, channelId: ctx.channelId,
            } as any);
        } catch (e: any) {
            // 分数已原子更新无法回滚：流水失败不能让调用方误以为整体失败（会重复加减分），
            // 但必须留告警，否则分数变动无流水可查。
            Logger.warn(
                `rider credit log save failed customer=${customerId} delta=${delta} reason=${reason}: ${e?.message ?? e}`,
                'CampusCredit',
            );
        }
        return next;
    }

    /** 骑手信用自动恢复：7 天没 timeout 扣分的骑手 credit<100 时 +5 分。
     *  每轮 dispatch sweep 每 channel 扫一次，每轮最多恢复 RECOVERY_LIMIT 人防长事务。
     *  并发安全：每个 customerId 单独 adjust 原子 UPDATE + 流水。 */
    async sweepRecovery(ctx: RequestContext): Promise<number> {
        const since = new Date(Date.now() - CREDIT_RECOVERY_DAYS * 86_400_000);
        // 排除近 7 天有 timeout_not_picked 扣分记录的骑手
        const rows: any[] = await this.connection.rawConnection.query(
            `SELECT DISTINCT c.id FROM "customer" c
             WHERE c."customFieldsRidercredit" IS NOT NULL
               AND c."customFieldsRidercredit" < ${CREDIT_RECOVERY_CAP}
               AND c.id IN (
                   SELECT DISTINCT customerId FROM rider_credit_log
                   WHERE channelId = $1
               )
               AND NOT EXISTS (
                   SELECT 1 FROM rider_credit_log log
                   WHERE log.customerId = c.id
                     AND log.channelId = $1
                     AND log.reason = 'timeout_not_picked'
                     AND log."createdAt" >= $2
               )
             LIMIT ${RECOVERY_LIMIT}`,
            [ctx.channelId, since],
        );
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        let recovered = 0;
        for (const r of list) {
            const id = Number(r.id);
            try {
                await this.adjust(ctx, id, CREDIT_RECOVERY_DELTA, 'recovery_7d_clean');
                recovered++;
            } catch (e: any) {
                Logger.warn(`credit recovery failed rider=${id}: ${e?.message}`, 'CampusCredit');
            }
        }
        if (recovered > 0) {
            Logger.info(
                `credit recovery channel=${ctx.channelId}: +${recovered} rider(s) +${CREDIT_RECOVERY_DELTA}pt`,
                'CampusCredit',
            );
        }
        return recovered;
    }
}
