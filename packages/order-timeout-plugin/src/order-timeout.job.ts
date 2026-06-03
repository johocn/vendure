import { Injectable } from '@nestjs/common';
import { ChannelService, JobQueue, JobQueueService, Logger, OrderService, RequestContext } from '@vendure/core';

import { loggerCtx } from './constants';

@Injectable()
export class OrderTimeoutJob {
    private jobQueue: JobQueue<{ orderId: string; channelId: string }>;

    constructor(
        private jobQueueService: JobQueueService,
        private orderService: OrderService,
        private channelService: ChannelService,
    ) {}

    async init(): Promise<void> {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'order-timeout',
            process: async (job) => {
                try {
                    const emptyCtx = RequestContext.empty();
                    const channel = await this.channelService.findOne(emptyCtx, job.data.channelId as any);
                    if (!channel) {
                        Logger.warn(`Channel ${job.data.channelId} not found, skipping timeout job`, loggerCtx);
                        return;
                    }
                    const ctx = new RequestContext({
                        apiType: 'admin',
                        channel,
                        isAuthorized: true,
                        authorizedAsOwnerOnly: false,
                    });
                    const order = await this.orderService.findOne(ctx, job.data.orderId as any);
                    if (order && order.state === 'ArrangingPayment') {
                        await this.orderService.cancelOrder(ctx, { orderId: job.data.orderId as any });
                        Logger.info(`Order ${job.data.orderId} cancelled due to timeout`, loggerCtx);
                    }
                } catch (e: any) {
                    Logger.error(`Failed to process timeout for order ${String(job.data.orderId)}: ${String(e.message)}`, loggerCtx);
                }
            },
        });
    }

    async scheduleCancellation(orderId: string, channelId: string, timeoutMinutes: number): Promise<void> {
        setTimeout(() => {
            void this.jobQueue.add({ orderId, channelId });
        }, timeoutMinutes * 60 * 1000);
    }
}
