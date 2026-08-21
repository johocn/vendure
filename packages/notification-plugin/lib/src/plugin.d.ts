import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventBus } from '@vendure/core';
import { NotificationService } from './notification.service';
import { NotificationPluginOptions } from './types';
export declare class NotificationPlugin implements OnApplicationBootstrap {
    private options;
    private eventBus;
    private notificationService;
    private moduleRef;
    private static options;
    constructor(options: NotificationPluginOptions, eventBus: EventBus, notificationService: NotificationService, moduleRef: ModuleRef);
    static init(options?: NotificationPluginOptions): Type<NotificationPlugin>;
    onApplicationBootstrap(): void;
}
