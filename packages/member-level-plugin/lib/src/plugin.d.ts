import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { MemberLevelPluginOptions } from './types';
import { MemberLevelService } from './member-level.service';
export declare class MemberLevelPlugin implements OnApplicationBootstrap {
    private options;
    private memberLevelService;
    private eventBus;
    private static options;
    constructor(options: MemberLevelPluginOptions, memberLevelService: MemberLevelService, eventBus: EventBus);
    static init(options?: MemberLevelPluginOptions): Type<MemberLevelPlugin>;
    onApplicationBootstrap(): Promise<void>;
    private handleOrderDelivered;
    private handleRefundSettled;
}
