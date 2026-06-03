import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { OrderTimeoutPluginOptions } from './types';
import { OrderTimeoutJob } from './order-timeout.job';
export declare class OrderTimeoutPlugin implements OnApplicationBootstrap {
    private options;
    private orderTimeoutJob;
    private eventBus;
    private static options;
    constructor(options: OrderTimeoutPluginOptions, orderTimeoutJob: OrderTimeoutJob, eventBus: EventBus);
    static init(options?: OrderTimeoutPluginOptions): Type<OrderTimeoutPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
