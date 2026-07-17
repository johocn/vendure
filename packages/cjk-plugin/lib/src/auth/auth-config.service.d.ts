import { RequestContext, ChannelService } from '@vendure/core';
import type { TenantAuthConfigMasked } from './auth-config.types';
export declare class AuthConfigService {
    private channelService;
    constructor(channelService: ChannelService);
    getMasked(ctx: RequestContext, channelId: string): Promise<TenantAuthConfigMasked | null>;
    update(ctx: RequestContext, channelId: string, patch: any): Promise<TenantAuthConfigMasked | null>;
}
