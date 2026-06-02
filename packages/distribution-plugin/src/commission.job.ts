import { Injectable } from '@nestjs/common';
import { ChannelService, JobQueue, JobQueueService, Logger, RequestContext } from '@vendure/core';

import { CommissionService } from './commission.service';
import { loggerCtx } from './constants';

@Injectable()
export class CommissionJob {
    private jobQueue: JobQueue<{ channelId: string }>;

    constructor(
        private jobQueueService: JobQueueService,
        private commissionService: CommissionService,
        private channelService: ChannelService,
    ) {}

    async init(): Promise<void> {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'commission-settlement',
            process: async (job) => {
                try {
                    const emptyCtx = RequestContext.empty();
                    const channel = await this.channelService.findOne(emptyCtx, job.data.channelId as any);
                    if (!channel) {
                        Logger.warn(`Channel ${job.data.channelId} not found, skipping commission settlement`, loggerCtx);
                        return;
                    }
                    const ctx = new RequestContext({
                        apiType: 'admin',
                        channel,
                        isAuthorized: true,
                        authorizedAsOwnerOnly: false,
                    });
                    const count = await this.commissionService.settlePendingCommissions(ctx);
                    Logger.info(`Settled ${count} pending commissions for channel ${job.data.channelId}`, loggerCtx);
                } catch (e: any) {
                    Logger.error(`Failed to process commission settlement for channel ${job.data.channelId}: ${e.message}`, loggerCtx);
                }
            },
        });
    }

    async scheduleSettlement(channelId: string): Promise<void> {
        setTimeout(() => {
            this.jobQueue.add({ channelId });
        }, 24 * 60 * 60 * 1000);
    }
}
