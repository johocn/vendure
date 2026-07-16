import { RequestContext } from '@vendure/core';
import type { SsoProviderInfo } from './auth-config.types';
export declare class AuthShopResolver {
    authMethods(ctx: RequestContext): {
        methods: string[];
        wechatAppId: string | null;
    };
    ssoProviders(ctx: RequestContext): SsoProviderInfo[];
}
