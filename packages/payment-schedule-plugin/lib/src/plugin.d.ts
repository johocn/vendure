import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventBus } from '@vendure/core';
import { PaymentScheduleService } from './payment-schedule.service';
import { PaymentSchedulePluginOptions } from './types';
export declare class PaymentSchedulePlugin implements OnApplicationBootstrap {
    private options;
    private scheduleService;
    private eventBus;
    private moduleRef;
    private static options;
    private injector;
    constructor(options: PaymentSchedulePluginOptions, scheduleService: PaymentScheduleService, eventBus: EventBus, moduleRef: ModuleRef);
    static init(options?: PaymentSchedulePluginOptions): Type<PaymentSchedulePlugin>;
    onApplicationBootstrap(): Promise<void>;
    private registerGroupBuyBridge;
}
