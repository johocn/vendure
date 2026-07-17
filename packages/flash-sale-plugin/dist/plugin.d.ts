import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventBus } from '@vendure/core';
import { FlashSaleJob } from './flash-sale.job';
import { FlashSaleService } from './flash-sale.service';
import { FlashSalePluginOptions } from './types';
export declare class FlashSalePlugin implements OnApplicationBootstrap {
    private options;
    private flashSaleService;
    private flashSaleJob;
    private eventBus;
    private moduleRef;
    private static options;
    private injector;
    constructor(options: FlashSalePluginOptions, flashSaleService: FlashSaleService, flashSaleJob: FlashSaleJob, eventBus: EventBus, moduleRef: ModuleRef);
    static init(options?: FlashSalePluginOptions): Type<FlashSalePlugin>;
    onApplicationBootstrap(): Promise<void>;
}
