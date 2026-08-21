import { OnApplicationBootstrap } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { CommunityPluginOptions } from './constants';
import { CommunityService } from './community.service';
export declare class CommunityPlugin implements OnApplicationBootstrap {
    private service;
    private eventBus;
    private static options;
    constructor(service: CommunityService, eventBus: EventBus);
    static init(options?: CommunityPluginOptions): typeof CommunityPlugin;
    onApplicationBootstrap(): void;
}
