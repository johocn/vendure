import { RequestContext, ChannelService } from '@vendure/core';
import type { BasicConfig } from './tenant-config.types';
export declare class BasicConfigService {
    private channelService;
    constructor(channelService: ChannelService);
    private parseStruct;
    private serializeDomain;
    get(ctx: RequestContext, channelId: string): Promise<BasicConfig | null>;
    update(ctx: RequestContext, channelId: string, patch: BasicConfig | null): Promise<BasicConfig | null>;
}
