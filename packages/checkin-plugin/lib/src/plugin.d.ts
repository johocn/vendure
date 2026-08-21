import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ConfigService, EventBus } from '@vendure/core';
import { CheckinService } from './checkin.service';
import { CheckinPluginOptions } from './types';
export declare class CheckinPlugin implements OnApplicationBootstrap {
    private options;
    private checkinService;
    private eventBus;
    private configService;
    static options: CheckinPluginOptions;
    constructor(options: CheckinPluginOptions, checkinService: CheckinService, eventBus: EventBus, configService: ConfigService);
    static init(options?: CheckinPluginOptions): Type<CheckinPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
