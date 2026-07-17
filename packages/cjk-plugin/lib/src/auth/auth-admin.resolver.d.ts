import { RequestContext, ChannelService } from '@vendure/core';
import { AuthConfigService } from './auth-config.service';
export declare class AuthAdminResolver {
    private channelService;
    private authConfigService;
    constructor(channelService: ChannelService, authConfigService: AuthConfigService);
    private assertChannelAccess;
    channelAuthConfig(ctx: RequestContext, args: {
        channelId: string;
    }): Promise<import("./auth-config.types").TenantAuthConfigMasked | null>;
    updateChannelAuthConfig(ctx: RequestContext, args: {
        channelId: string;
        input: any;
    }): Promise<import("./auth-config.types").TenantAuthConfigMasked | null>;
}
