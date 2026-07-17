import { Connection } from 'typeorm';
import { RequestContext } from '@vendure/core';
import { AuthConfigService } from '../auth/auth-config.service';
import { PayConfigService } from '../payment/pay-config.service';
import { MapConfigService } from '../map/map-config.service';
import { SsoProviderService } from '../auth/sso-provider.service';
export declare class TenantConfigAdminResolver {
    private authConfigService;
    private payConfigService;
    private mapConfigService;
    private ssoProviderService;
    private connection;
    constructor(authConfigService: AuthConfigService, payConfigService: PayConfigService, mapConfigService: MapConfigService, ssoProviderService: SsoProviderService, connection: Connection);
    private canEdit;
    private assertCanWrite;
    tenantConfig(ctx: RequestContext, args: {
        channelId: string;
    }): Promise<{
        channelId: string;
        auth: import("../..").TenantAuthConfigMasked | null;
        pay: import("../..").PayConfig | null;
        map: import("../map/map-config").MapProviderConfig | null;
        canEdit: boolean;
    }>;
    updateTenantConfig(ctx: RequestContext, args: {
        input: any;
    }): Promise<{
        channelId: string;
        auth: import("../..").TenantAuthConfigMasked | null;
        pay: import("../..").PayConfig | null;
        map: import("../map/map-config").MapProviderConfig | null;
        canEdit: boolean;
    }>;
    testSsoConnection(ctx: RequestContext, args: {
        input: any;
    }): Promise<import("../auth/sso-provider.service").TestSsoResult>;
}
