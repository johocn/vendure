import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { LogisticsPluginOptions } from './types';
import { LogisticsService } from './logistics.service';
import { AutoSplitPlanService } from './auto-split-plan.service';
import { ManualSplitAdjustService } from './manual-split-adjust.service';
export declare class LogisticsPlugin implements OnApplicationBootstrap {
    private options;
    private logisticsService;
    private autoSplit;
    private manualSplit;
    private moduleRef;
    private static options;
    private injector;
    constructor(options: LogisticsPluginOptions, logisticsService: LogisticsService, autoSplit: AutoSplitPlanService, manualSplit: ManualSplitAdjustService, moduleRef: ModuleRef);
    static init(options?: LogisticsPluginOptions): Type<LogisticsPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
