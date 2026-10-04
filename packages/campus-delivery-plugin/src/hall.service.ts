import { Injectable } from '@nestjs/common';
import { Logger, Order, RequestContext, TransactionalConnection } from '@vendure/core';

/**
 * 入厅服务：跑腿单（orderKind='errand'）或路线 R1/R3 的订单在支付后自动进入抢单大厅。
 */
@Injectable()
export class HallService {
    constructor(private connection: TransactionalConnection) {}

    async onOrderPlaced(ctx: RequestContext, order: Order) {
        const cf = order.customFields as any;
        if (cf.orderKind === 'errand' || cf.fulfillmentRoute === 'R1' || cf.fulfillmentRoute === 'R3') {
            await this.connection.getRepository(ctx, Order).update(order.id, {
                customFields: { hallStatus: 'open', hallEnteredAt: new Date() },
            } as any);
            Logger.info(`Order ${order.code} entered hall (${cf.fulfillmentRoute})`, 'CampusHall');
        }
    }
}
