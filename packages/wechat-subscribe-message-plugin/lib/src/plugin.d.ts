import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { SubscribeMessageService } from './subscribe-message.service';
import { WechatSubscribeMessagePluginOptions } from './types';
export declare class WechatSubscribeMessagePlugin implements OnApplicationBootstrap {
    private options;
    private subscribeMessageService;
    private eventBus;
    private static options;
    constructor(options: WechatSubscribeMessagePluginOptions, subscribeMessageService: SubscribeMessageService, eventBus: EventBus);
    static init(options?: WechatSubscribeMessagePluginOptions): Type<WechatSubscribeMessagePlugin>;
    onApplicationBootstrap(): Promise<void>;
    private handleOrderPaid;
    private handleOrderShipped;
    private handleOrderDelivered;
    private handleOrderRefunded;
}
