import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AfterSalesPluginOptions } from './types';
import { AfterSalesService } from './after-sales.service';
export declare class AfterSalesPlugin implements OnApplicationBootstrap {
    private options;
    private afterSalesService;
    private moduleRef;
    private static options;
    private injector;
    constructor(options: AfterSalesPluginOptions, afterSalesService: AfterSalesService, moduleRef: ModuleRef);
    static init(options?: AfterSalesPluginOptions): Type<AfterSalesPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
