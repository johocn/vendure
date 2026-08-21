import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { OrderService } from '@vendure/core';
import { RechargeCardPluginOptions } from './types';
import { RechargeCardService } from './recharge-card.service';
export declare class RechargeCardPlugin implements OnApplicationBootstrap {
    private options;
    private rechargeCardService;
    private orderService;
    private moduleRef;
    private static options;
    constructor(options: RechargeCardPluginOptions, rechargeCardService: RechargeCardService, orderService: OrderService, moduleRef: ModuleRef);
    static init(options?: RechargeCardPluginOptions): Type<RechargeCardPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
