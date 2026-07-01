import { ChannelService, JobQueueService } from '@vendure/core';
import { CommissionService } from './commission.service';
export declare class CommissionJob {
    private jobQueueService;
    private commissionService;
    private channelService;
    private jobQueue;
    constructor(jobQueueService: JobQueueService, commissionService: CommissionService, channelService: ChannelService);
    init(): Promise<void>;
    scheduleSettlement(channelId: string): Promise<void>;
}
