import { OnApplicationBootstrap } from '@nestjs/common';
import { EventBus, Injector } from '@vendure/core';
import { HallService } from './hall.service';
export declare class CampusDeliveryPlugin implements OnApplicationBootstrap {
    private eventBus;
    private hallService;
    private injector;
    constructor(eventBus: EventBus, hallService: HallService, injector: Injector);
    onApplicationBootstrap(): void;
}
