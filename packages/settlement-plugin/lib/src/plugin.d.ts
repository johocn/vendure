import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { SettlementService } from './settlement.service';
import { SettlementPluginOptions } from './types';
export declare class SettlementPlugin implements OnApplicationBootstrap {
    private options;
    private eventBus;
    private settlementService;
    private static options;
    constructor(options: SettlementPluginOptions, eventBus: EventBus, settlementService: SettlementService);
    static init(options?: SettlementPluginOptions): Type<SettlementPlugin>;
    onApplicationBootstrap(): void;
}
