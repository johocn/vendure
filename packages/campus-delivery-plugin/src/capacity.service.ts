import { Injectable } from '@nestjs/common';
import { Customer, RequestContext, TransactionalConnection } from '@vendure/core';

import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { RiderService } from './rider.service';

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

@Injectable()
export class CapacityService {
    constructor(
        private connection: TransactionalConnection,
        private riderService: RiderService,
    ) {}

    /** 在线骑手：approved 且 5min 内有心跳。运力池当前不分分区（MVP），后续在此加 where。
     * customFields 为嵌入式物理列，QueryBuilder 用 embedded 路径 customer.customFields.riderStatus
     * （与 rider.service.ts listApplications 写法一致）。内存侧再校验一次 riderStatus 双保险。 */
    async listOnlineRiders(ctx: RequestContext): Promise<Customer[]> {
        const customers = await this.connection
            .getRepository(ctx, Customer)
            .createQueryBuilder('customer')
            .where('customer.customFields.riderStatus = :status', { status: 'approved' })
            .andWhere('customer.customFields.riderOnlineAt IS NOT NULL')
            .getMany();
        const now = Date.now();
        return customers.filter(c => {
            const cf = (c.customFields ?? {}) as any;
            const at = cf.riderOnlineAt;
            return cf.riderStatus === 'approved' && at && now - new Date(at).getTime() <= ONLINE_WINDOW_MS;
        });
    }

    /** T0 预检：C 端下单前提示「运力紧张」 */
    async capacityCheck(ctx: RequestContext): Promise<{ paused: boolean; ridersOnline: number }> {
        const cfg = await this.connection
            .getRepository(ctx, CampusFulfillmentConfig)
            .findOne({ where: { channelId: ctx.channelId as any } });
        const riders = await this.listOnlineRiders(ctx);
        return { paused: cfg?.paused ?? false, ridersOnline: riders.length };
    }

    /** 心跳（带骑手资格校验的封装）：骑手端 30s 定时调 */
    async heartbeat(ctx: RequestContext) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        await this.connection.getRepository(ctx, Customer).update(rider.id, {
            customFields: { riderOnlineAt: new Date() },
        } as any);
        return { online: true };
    }
}
