import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { LogisticsPluginOptions } from './types';
import { LogisticsService } from './logistics.service';
export declare class LogisticsPlugin implements OnApplicationBootstrap {
    private options;
    private logisticsService;
    private moduleRef;
    private static options;
    private injector;
    constructor(options: LogisticsPluginOptions, logisticsService: LogisticsService, moduleRef: ModuleRef);
    static init(options?: LogisticsPluginOptions): Type<LogisticsPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
