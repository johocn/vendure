import { OnApplicationBootstrap } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { CommunityPluginOptions } from './constants';
import { CommunityService } from './community.service';
/** 共享类型全部放 admin schema；shop schema 仅 extend Query/Mutation 引用。 */
export declare class CommunityPlugin implements OnApplicationBootstrap {
    private service;
    private eventBus;
    constructor(service: CommunityService, eventBus: EventBus);
    static init(options: CommunityPluginOptions): {
        module: typeof CommunityPlugin;
        providers: {
            provide: symbol;
            useValue: CommunityPluginOptions;
        }[];
    };
    onApplicationBootstrap(): void;
}
