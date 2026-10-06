import { OnApplicationBootstrap } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { ModuleRef } from '@nestjs/core';
import { HallService } from './hall.service';
import { R4TagService } from './r4-tag.service';
export declare class CampusDeliveryPlugin implements OnApplicationBootstrap {
    private eventBus;
    private hallService;
    private r4TagService;
    private moduleRef;
    constructor(eventBus: EventBus, hallService: HallService, r4TagService: R4TagService, moduleRef: ModuleRef);
    /** vendure Injector 需由 ModuleRef 构造（插件模块类构造器不直接提供 Injector） */
    private get injector();
    onApplicationBootstrap(): void;
}
