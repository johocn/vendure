import { Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';
import { RiderCreditLog } from './rider-credit-log.entity';

export const CREDIT_COMPLETE = 2;
export const CREDIT_REJECT = -5;
export const CREDIT_TIMEOUT = -10;
export const CREDIT_LIMIT = 60;

@Injectable()
export class RiderCreditService {
    constructor(private connection: TransactionalConnection) {}

    /** 加减分 + 流水。下限 0。
     * 并发安全：单条 UPDATE 原子读改写（GREATEST 夹紧），避免并发 adjust 互相覆盖丢分。
     * 列名为 customFields 物理列（riderCredit → customFieldsRidercredit）。 */
    async adjust(ctx: RequestContext, customerId: number, delta: number, reason: string, orderId?: number) {
        const rows: any = await this.connection.rawConnection.query(
            'UPDATE "customer" SET "customFieldsRidercredit" = '
            + 'GREATEST(0, COALESCE("customFieldsRidercredit", 100) + $1) '
            + 'WHERE id = $2 RETURNING "customFieldsRidercredit" AS credit',
            [delta, customerId],
        );
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        const next = Number(list?.[0]?.credit ?? (delta > 0 ? 100 + delta : 100));
        await this.connection.getRepository(ctx, RiderCreditLog).save({
            customerId, delta, reason, orderId: orderId ?? null, channelId: ctx.channelId,
        } as any);
        return next;
    }
}
