import { Injectable } from '@nestjs/common';
import {
    ChannelService,
    JobQueue,
    JobQueueService,
    Logger,
    OrderService,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

import { GroupBuyActivity } from './group-buy-activity.entity';
import { GroupBuyOrder } from './group-buy-order.entity';
import { loggerCtx } from './constants';

@Injectable()
export class GroupBuyJob {
    private jobQueue: JobQueue<{}>;

    constructor(
        private jobQueueService: JobQueueService,
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private channelService: ChannelService,
    ) {}

    async init(): Promise<void> {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'group-buy-check',
            process: async (job) => {
                try {
                    const emptyCtx = RequestContext.empty();
                    const channels = await this.channelService.findAll(emptyCtx);
                    for (const channel of channels.items) {
                        const ctx = new RequestContext({
                            apiType: 'admin',
                            channel,
                            isAuthorized: true,
                            authorizedAsOwnerOnly: false,
                        });

                        const activityRepo = this.connection.getRepository(ctx, GroupBuyActivity);
                        const orderRepo = this.connection.getRepository(ctx, GroupBuyOrder);

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

                            if (activity.status === 'expired') {
                                const pendingOrders = await orderRepo.find({
                                    where: { groupBuyActivityId: activity.id as any, status: 'pending' },
                                });

                                for (const gbo of pendingOrders) {
                                    try {
                                        await this.orderService.cancelOrder(ctx, { orderId: gbo.orderId as any });
                                        gbo.status = 'failed';
                                        await orderRepo.save(gbo);
                                        Logger.info(`Cancelled group buy order ${gbo.orderId} for expired activity ${activity.id}`, loggerCtx);
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
                } catch (e: any) {
                    Logger.error(`Failed to process group buy check: ${e.message}`, loggerCtx);
                }
            },
        });
    }

    scheduleCheck(): void {
        const scheduleNext = () => {
            setTimeout(() => {
                this.jobQueue.add({});
                scheduleNext();
            }, 60 * 1000);
        };
        scheduleNext();
    }
}
