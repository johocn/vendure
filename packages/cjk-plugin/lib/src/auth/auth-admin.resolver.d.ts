import { RequestContext, ChannelService } from '@vendure/core';
import type { TenantAuthConfigMasked } from './auth-config.types';
export declare class AuthAdminResolver {
    private channelService;
    constructor(channelService: ChannelService);
    channelAuthConfig(ctx: RequestContext, args: {
        channelId: string;
    }): Promise<TenantAuthConfigMasked | null>;
    updateChannelAuthConfig(ctx: RequestContext, args: {
        channelId: string;
        input: any;
    }): Promise<boolean>;
}
