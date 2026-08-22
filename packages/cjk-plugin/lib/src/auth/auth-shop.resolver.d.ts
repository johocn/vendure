import { RequestContext } from '@vendure/core';
import type { SsoProviderInfo } from './auth-config.types';
export declare class AuthShopResolver {
    authMethods(ctx: RequestContext): {
        methods: string[];
        wechatAppId: string | null;
    };
    ssoProviders(ctx: RequestContext): SsoProviderInfo[];
    /**
     * 方向B：已登录本地账号绑定 SSO 身份（SSO↔本地账号互认）。
     * 校验 code → 得外部身份 → 挂到当前已登录 User。
     */
    bindSsoIdentity(ctx: RequestContext, providerKey: string, code: string, redirectUri?: string): Promise<{
        bound: boolean;
        userId: string;
        identifier?: string;
        reason?: string;
    }>;
}
