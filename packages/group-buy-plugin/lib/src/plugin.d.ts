import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventBus } from '@vendure/core';
import { GroupBuyPluginOptions } from './types';
import { GroupBuyService } from './group-buy.service';
import { GroupBuyJob } from './group-buy.job';
export declare class GroupBuyPlugin implements OnApplicationBootstrap {
    private options;
    private groupBuyService;
    private groupBuyJob;
    private eventBus;
    private moduleRef;
    private static options;
    private injector;
    constructor(options: GroupBuyPluginOptions, groupBuyService: GroupBuyService, groupBuyJob: GroupBuyJob, eventBus: EventBus, moduleRef: ModuleRef);
    static init(options?: GroupBuyPluginOptions): Type<GroupBuyPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
