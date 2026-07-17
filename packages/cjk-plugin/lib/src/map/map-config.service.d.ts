import { RequestContext, ChannelService } from '@vendure/core';
import type { MapProviderConfig } from './map-config';
export declare class MapConfigService {
    private channelService;
    constructor(channelService: ChannelService);
    getMasked(ctx: RequestContext, channelId: string): Promise<MapProviderConfig | null>;
    getDecrypted(ctx: RequestContext, channelId: string): Promise<MapProviderConfig | null>;
    update(ctx: RequestContext, channelId: string, patch: Partial<MapProviderConfig> | null): Promise<MapProviderConfig | null>;
}
