import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventBus } from '@vendure/core';
import { PreSaleService } from './pre-sale.service';
import { PreSalePluginOptions } from './types';
export declare class PreSalePlugin implements OnApplicationBootstrap {
    private options;
    private preSaleService;
    private eventBus;
    private moduleRef;
    private static options;
    private injector;
    constructor(options: PreSalePluginOptions, preSaleService: PreSaleService, eventBus: EventBus, moduleRef: ModuleRef);
    static init(options?: PreSalePluginOptions): Type<PreSalePlugin>;
    onApplicationBootstrap(): Promise<void>;
}
