import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ChannelService } from '@vendure/core';
import { CommissionJob } from './commission.job';
import { CommissionService } from './commission.service';
import { DistributionPluginOptions } from './types';
export declare class DistributionPlugin implements OnApplicationBootstrap {
    private options;
    private commissionService;
    private commissionJob;
    private channelService;
    private static options;
    constructor(options: DistributionPluginOptions, commissionService: CommissionService, commissionJob: CommissionJob, channelService: ChannelService);
    static init(options?: DistributionPluginOptions): Type<DistributionPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
