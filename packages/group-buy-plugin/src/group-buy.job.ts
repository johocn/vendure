import { Injectable } from '@nestjs/common';
import {
    ChannelService,
    Injector,
    Logger,
    Order,
    OrderService,
    PaymentService,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

import { GroupBuyActivity } from './group-buy-activity.entity';
import { GroupBuyOrder } from './group-buy-order.entity';
import { loggerCtx } from './constants';

@Injectable()
export class GroupBuyJob {
    constructor(
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private paymentService: PaymentService,
        private channelService: ChannelService,
    ) {}

    private stockPrewarmService: any = null;

    initStock(injector: Injector): void {
        try {
            const { StockPrewarmService } = require('@vendure/redis-stock-plugin');
            this.stockPrewarmService = injector.get(StockPrewarmService);
        } catch {
            // RedisStockPlugin not installed
        }
    }

    // 由 GroupBuyScheduledTask 每分钟触发，避免多实例内存 setTimeout 并发。
    async runCheck(ctx: RequestContext): Promise<void> {
        const channels = await this.channelService.findAll(ctx);
        for (const channel of channels.items) {
            const channelCtx = new RequestContext({
                apiType: 'admin',
                channel,
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
            });

            const activityRepo = this.connection.getRepository(channelCtx, GroupBuyActivity);
            const orderRepo = this.connection.getRepository(channelCtx, GroupBuyOrder);

            const now = new Date();
            const expiredActivities = await activityRepo
                .createQueryBuilder('gba')
                .innerJoin('gba.channels', 'channel', 'channel.id = :channelId', { channelId: channel.id })
                .where('gba.endAt < :now', { now })
                .andWhere('gba.status = :status', { status: 'active' })
                .getMany();

            for (const activity of expiredActivities) {
                if (activity.currentCount >= activity.targetCount) {
                    activity.status = 'completed';
                } else {
                    activity.status = 'expired';
                }
                await activityRepo.save(activity);

                if (this.stockPrewarmService) {
                    await this.stockPrewarmService.removePrewarm(`group-buy:${activity.id}`);
                }

                if (activity.status === 'expired') {
                    const pendingOrders = await orderRepo.find({
                        where: { groupBuyActivityId: activity.id as any, status: 'pending' },
                    });

                    for (const gbo of pendingOrders) {
                        try {
                            await this.orderService.cancelOrder(channelCtx, { orderId: gbo.orderId as any });
                            await this.refundOrderPayments(channelCtx, gbo.orderId);
                            gbo.status = 'failed';
                            await orderRepo.save(gbo);
                            Logger.info(`Cancelled and refunded group buy order ${gbo.orderId} for expired activity ${activity.id}`, loggerCtx);
                        } catch (e: any) {
                            Logger.error(`Failed to cancel group buy order ${gbo.orderId}: ${e.message}`, loggerCtx);
                        }
                    }
                } else {
                    const pendingOrders = await orderRepo.find({
                        where: { groupBuyActivityId: activity.id as any, status: 'pending' },
                    });
                    for (const gbo of pendingOrders) {
                        gbo.status = 'success';
                        await orderRepo.save(gbo);
                    }
                }

                Logger.info(`Activity ${activity.id} status changed to ${activity.status}`, loggerCtx);
            }
        }
    }

    private async refundOrderPayments(ctx: RequestContext, orderId: string): Promise<void> {
        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
            relations: ['payments'],
        });
        if (!order?.payments?.length) {
            return;
        }
        for (const payment of order.payments) {
            if ((payment.state as string) === 'Settled') {
                try {
                    const result = await this.paymentService.createRefund(
                        ctx,
                        {
                            paymentId: payment.id,
                            amount: payment.amount,
                            reason: 'Group buy failed/expired',
                        },
                        order,
                        payment,
                    );
                    if (result instanceof Error) {
                        Logger.warn(`Refund for payment ${payment.id} returned error: ${result.message}`, loggerCtx);
                    }
                } catch (e: any) {
                    Logger.error(`Failed to refund payment ${payment.id} for order ${orderId}: ${e.message}`, loggerCtx);
                }
            }
        }
    }
}
