import { Injectable } from '@nestjs/common';
import { JobQueue, JobQueueService, Logger, TransactionalConnection } from '@vendure/core';

import { loggerCtx } from './constants';
import { FlashSaleActivity } from './flash-sale-activity.entity';

@Injectable()
export class FlashSaleJob {
    private jobQueue: JobQueue<{}>;
    private intervalRef: NodeJS.Timeout | undefined;

    constructor(
        private jobQueueService: JobQueueService,
        private connection: TransactionalConnection,
    ) {}

    async init(): Promise<void> {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'flash-sale-status',
            process: async (job) => {
                try {
                    await this.processStatusTransitions();
                } catch (e: any) {
                    Logger.error(`Failed to process flash sale status: ${e.message}`, loggerCtx);
                }
            },
        });
    }

    scheduleCheck(): void {
        this.intervalRef = setInterval(() => {
            this.jobQueue.add({});
        }, 60 * 1000);
    }

    private async processStatusTransitions(): Promise<void> {
        const repo = this.connection.rawConnection.getRepository(FlashSaleActivity);
        const now = new Date();

        const toActivate = await repo
            .createQueryBuilder('fsa')
            .where('fsa.status = :status', { status: 'upcoming' })
            .andWhere('fsa.startAt <= :now', { now })
            .getMany();

        for (const activity of toActivate) {
            activity.status = 'active';
            await repo.save(activity);
            Logger.info(`FlashSaleActivity ${activity.id} activated`, loggerCtx);
        }

        const toEnd = await repo
            .createQueryBuilder('fsa')
            .where('fsa.status = :status', { status: 'active' })
            .andWhere('fsa.endAt <= :now', { now })
            .getMany();

        for (const activity of toEnd) {
            activity.status = 'ended';
            await repo.save(activity);
            Logger.info(`FlashSaleActivity ${activity.id} ended`, loggerCtx);
        }
    }
}
