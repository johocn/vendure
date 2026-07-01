import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { RechargeCardPluginOptions } from './types';
import { RechargeCardService } from './recharge-card.service';
export declare class RechargeCardPlugin implements OnApplicationBootstrap {
    private options;
    private rechargeCardService;
    private static options;
    constructor(options: RechargeCardPluginOptions, rechargeCardService: RechargeCardService);
    static init(options?: RechargeCardPluginOptions): Type<RechargeCardPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
