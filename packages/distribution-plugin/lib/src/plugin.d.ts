import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { CommissionService } from './commission.service';
import { DistributionPluginOptions } from './types';
export declare class DistributionPlugin implements OnApplicationBootstrap {
    private options;
    private commissionService;
    private static options;
    constructor(options: DistributionPluginOptions, commissionService: CommissionService);
    static init(options?: DistributionPluginOptions): Type<DistributionPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
