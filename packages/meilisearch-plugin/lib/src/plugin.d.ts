import { Type } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { MeiliService } from './meili.service';
import { ProductSyncService } from './product-sync.service';
import { MeiliPluginOptions } from './types';
export declare class MeiliSearchPlugin {
    private options;
    private meiliService;
    private productSync;
    private eventBus;
    static options: MeiliPluginOptions;
    constructor(options: MeiliPluginOptions, meiliService: MeiliService, productSync: ProductSyncService, eventBus: EventBus);
    static init(options: MeiliPluginOptions): Type<MeiliSearchPlugin>;
    onApplicationBootstrap(): Promise<void>;
    private subscribeEvents;
    private onProductEvent;
    private onVariantEvent;
}
