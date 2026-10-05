import { Injectable } from '@nestjs/common';
import { Logger, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { SlotLockService } from './slot-lock.service';

/**
 * 入厅服务：跑腿单（orderKind='errand'）或路线 R1/R3 的订单在支付后自动进入抢单大厅。
 * 含预约时段锁位（T0 前置）：锁位失败标 campusCause='slot_full'，靠调度告警人工跟进。
 */
@Injectable()
export class HallService {
    constructor(
        private connection: TransactionalConnection,
        private slotLock: SlotLockService,
    ) {}

    async onOrderPlaced(ctx: RequestContext, order: Order) {
        const cf = order.customFields as any;
        if (cf.orderKind === 'errand' || cf.fulfillmentRoute === 'R1' || cf.fulfillmentRoute === 'R3') {
            const locked = await this.slotLock.lock(ctx, order);
            await this.connection.getRepository(ctx, Order).update(order.id, {
                customFields: {
                    hallStatus: 'open',
                    hallEnteredAt: new Date(),
                    ...(locked ? {} : { campusCause: 'slot_full' }),
                },
            } as any);
            Logger.info(
                `Order ${order.code} entered hall (${cf.fulfillmentRoute}, slot=${cf.deliverySlotText ?? 'immediate'}, slotLocked=${locked})`,
                'CampusHall',
            );
        }
    }
}
