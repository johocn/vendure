import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { GroupBuyPluginOptions } from './types';
import { GroupBuyJob } from './group-buy.job';
export declare class GroupBuyPlugin implements OnApplicationBootstrap {
    private options;
    private groupBuyJob;
    private static options;
    constructor(options: GroupBuyPluginOptions, groupBuyJob: GroupBuyJob);
    static init(options?: GroupBuyPluginOptions): Type<GroupBuyPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
