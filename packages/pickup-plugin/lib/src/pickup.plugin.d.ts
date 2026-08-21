import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { PickupPluginOptions } from './constants';
import { PickupService } from './pickup.service';
export declare class PickupPlugin implements OnApplicationBootstrap {
    private options;
    private service;
    private eventBus;
    private static options;
    constructor(options: PickupPluginOptions, service: PickupService, eventBus: EventBus);
    static init(options?: PickupPluginOptions): Type<PickupPlugin>;
    onApplicationBootstrap(): void;
}
