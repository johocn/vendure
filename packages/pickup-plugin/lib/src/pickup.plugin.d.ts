import { DynamicModule, OnApplicationBootstrap } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { PickupPluginOptions } from './constants';
import { PickupService } from './pickup.service';
export declare class PickupPlugin implements OnApplicationBootstrap {
    private service;
    private eventBus;
    constructor(service: PickupService, eventBus: EventBus);
    static init(options: PickupPluginOptions): DynamicModule;
    onApplicationBootstrap(): void;
}
