import { RequestContext } from '@vendure/core';
import type { SsoProviderInfo } from './auth-config.types';
export declare class AuthShopResolver {
    authMethods(ctx: RequestContext): string[];
    ssoProviders(ctx: RequestContext): SsoProviderInfo[];
}
