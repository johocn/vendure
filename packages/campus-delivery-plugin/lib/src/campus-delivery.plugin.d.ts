import { OnApplicationBootstrap } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { ModuleRef } from '@nestjs/core';
import { HallService } from './hall.service';
export declare class CampusDeliveryPlugin implements OnApplicationBootstrap {
    private eventBus;
    private hallService;
    private moduleRef;
    constructor(eventBus: EventBus, hallService: HallService, moduleRef: ModuleRef);
    /** vendure Injector 需由 ModuleRef 构造（插件模块类构造器不直接提供 Injector） */
    private get injector();
    onApplicationBootstrap(): void;
}
