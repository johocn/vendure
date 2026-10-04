import { OnApplicationBootstrap } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { HallService } from './hall.service';
export declare class CampusDeliveryPlugin implements OnApplicationBootstrap {
    private eventBus;
    private hallService;
    constructor(eventBus: EventBus, hallService: HallService);
    onApplicationBootstrap(): void;
}
