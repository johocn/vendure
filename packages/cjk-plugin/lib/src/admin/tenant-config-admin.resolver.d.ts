import { Connection } from 'typeorm';
import { RequestContext } from '@vendure/core';
import { AuthConfigService } from '../auth/auth-config.service';
import { PayConfigService } from '../payment/pay-config.service';
import { MapConfigService } from '../map/map-config.service';
import { SsoProviderService } from '../auth/sso-provider.service';
import { BasicConfigService } from '../tenant/basic-config.service';
import { MultiLanguageConfigService } from '../tenant/multi-language-config.service';
import { ServiceNotifyConfigService } from '../tenant/service-notify-config.service';
export declare class TenantConfigAdminResolver {
    private authConfigService;
    private payConfigService;
    private mapConfigService;
    private ssoProviderService;
    private basicConfigService;
    private multiLanguageConfigService;
    private serviceNotifyConfigService;
    private connection;
    constructor(authConfigService: AuthConfigService, payConfigService: PayConfigService, mapConfigService: MapConfigService, ssoProviderService: SsoProviderService, basicConfigService: BasicConfigService, multiLanguageConfigService: MultiLanguageConfigService, serviceNotifyConfigService: ServiceNotifyConfigService, connection: Connection);
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
    tenantSettings(ctx: RequestContext, channelId: string): Promise<{
        channelId: string;
        basic: import("../tenant/tenant-config.types").BasicConfig | null;
        auth: import("../..").TenantAuthConfigMasked | null;
        pay: import("../..").PayConfig | null;
        map: import("../map/map-config").MapProviderConfig | null;
        serviceNotify: import("../tenant/service-notify-config.service").ServiceNotifyConfig | null;
        multiLanguage: import("../tenant/multi-language-config.service").MultiLanguageConfig | null;
        canEdit: boolean;
    }>;
    updateTenantBasic(ctx: RequestContext, args: {
        input: any;
    }): Promise<{
        channelId: string;
        basic: import("../tenant/tenant-config.types").BasicConfig | null;
        auth: import("../..").TenantAuthConfigMasked | null;
        pay: import("../..").PayConfig | null;
        map: import("../map/map-config").MapProviderConfig | null;
        serviceNotify: import("../tenant/service-notify-config.service").ServiceNotifyConfig | null;
        multiLanguage: import("../tenant/multi-language-config.service").MultiLanguageConfig | null;
        canEdit: boolean;
    }>;
    updateTenantMultiLanguage(ctx: RequestContext, args: {
        input: any;
    }): Promise<{
        channelId: string;
        basic: import("../tenant/tenant-config.types").BasicConfig | null;
        auth: import("../..").TenantAuthConfigMasked | null;
        pay: import("../..").PayConfig | null;
        map: import("../map/map-config").MapProviderConfig | null;
        serviceNotify: import("../tenant/service-notify-config.service").ServiceNotifyConfig | null;
        multiLanguage: import("../tenant/multi-language-config.service").MultiLanguageConfig | null;
        canEdit: boolean;
    }>;
    updateTenantServiceNotify(ctx: RequestContext, args: {
        input: any;
    }): Promise<{
        channelId: string;
        basic: import("../tenant/tenant-config.types").BasicConfig | null;
        auth: import("../..").TenantAuthConfigMasked | null;
        pay: import("../..").PayConfig | null;
        map: import("../map/map-config").MapProviderConfig | null;
        serviceNotify: import("../tenant/service-notify-config.service").ServiceNotifyConfig | null;
        multiLanguage: import("../tenant/multi-language-config.service").MultiLanguageConfig | null;
        canEdit: boolean;
    }>;
    private writeAudit;
    testSsoConnection(ctx: RequestContext, args: {
        input: any;
    }): Promise<import("../auth/sso-provider.service").TestSsoResult>;
}
