import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventBus } from '@vendure/core';
import { AfterSalesPluginOptions } from './types';
import { AfterSalesService } from './after-sales.service';
import { AfterSalesTimeoutJob } from './after-sales-timeout.job';
export declare class AfterSalesPlugin implements OnApplicationBootstrap {
    private options;
    private afterSalesService;
    private afterSalesTimeoutJob;
    private eventBus;
    private moduleRef;
    private static options;
    private injector;
    constructor(options: AfterSalesPluginOptions, afterSalesService: AfterSalesService, afterSalesTimeoutJob: AfterSalesTimeoutJob, eventBus: EventBus, moduleRef: ModuleRef);
    static init(options?: AfterSalesPluginOptions): Type<AfterSalesPlugin>;
    onApplicationBootstrap(): Promise<void>;
    private onAfterSalesStateTransition;
}
