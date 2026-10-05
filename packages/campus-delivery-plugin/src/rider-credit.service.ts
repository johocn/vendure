import { Injectable } from '@nestjs/common';
import { Customer, RequestContext, TransactionalConnection } from '@vendure/core';
import { RiderCreditLog } from './rider-credit-log.entity';

export const CREDIT_COMPLETE = 2;
export const CREDIT_REJECT = -5;
export const CREDIT_TIMEOUT = -10;
export const CREDIT_LIMIT = 60;

@Injectable()
export class RiderCreditService {
    constructor(private connection: TransactionalConnection) {}

    /** 加减分 + 流水。下限 0。
     * 读取在 rawConnection.transaction 内直读 customFields.riderCredit（与 grab 事务模式一致），更新/流水走 ctx 仓储。 */
    async adjust(ctx: RequestContext, customerId: number, delta: number, reason: string, orderId?: number) {
        const next = await this.connection.rawConnection.transaction(async em => {
            const customer = await em.getRepository(Customer).findOne({ where: { id: customerId as any } });
            const current = (customer?.customFields as any)?.riderCredit ?? 100;
            return Math.max(0, current + delta);
        });
        await this.connection.getRepository(ctx, Customer).update(customerId, {
            customFields: { riderCredit: next },
        } as any);
        await this.connection.getRepository(ctx, RiderCreditLog).save({
            customerId, delta, reason, orderId: orderId ?? null, channelId: ctx.channelId,
        } as any);
        return next;
    }
}
