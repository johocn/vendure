import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { OrderTimeoutJob } from './order-timeout.job';
import { OrderTimeoutPluginOptions } from './types';
export declare class OrderTimeoutPlugin implements OnApplicationBootstrap {
    private options;
    private orderTimeoutJob;
    private eventBus;
    private static options;
    constructor(options: OrderTimeoutPluginOptions, orderTimeoutJob: OrderTimeoutJob, eventBus: EventBus);
    static init(options?: OrderTimeoutPluginOptions): Type<OrderTimeoutPlugin>;
    onApplicationBootstrap(): Promise<void>;
    private schedule;
}
