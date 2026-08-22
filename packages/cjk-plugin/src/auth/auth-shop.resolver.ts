import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ForbiddenError, Permission, RequestContext } from '@vendure/core';
import { readChannelAuthConfig } from './crypto';
import { ssoAuthenticationStrategy } from './sso-authentication-strategy';
import type { SsoProvider, SsoProviderInfo } from './auth-config.types';

@Resolver()
export class AuthShopResolver {
    @Query()
    authMethods(@Ctx() ctx: RequestContext): { methods: string[]; wechatAppId: string | null } {
        // readChannelAuthConfig 是同步函数，无需 async/await
        const config = readChannelAuthConfig(ctx);
        if (!config?.enabledMethods) {
            // 向后兼容：返回所有已注册策略
            return { methods: ['native', 'phone', 'wechat', 'alipay', 'douyin'], wechatAppId: null };
        }
        let wechatAppId: string | null = null;
        if (config.enabledMethods.includes('wechat')) {
            const wechatOverride = (config.overrides as Record<string, any> | undefined)?.wechat;
            wechatAppId = wechatOverride?.appId || null;
        }
        return { methods: config.enabledMethods, wechatAppId };
    }

    @Query()
    ssoProviders(@Ctx() ctx: RequestContext): SsoProviderInfo[] {
        const config = readChannelAuthConfig(ctx);
        if (!config?.ssoProviders) return [];
        return config.ssoProviders.map((p) => ({
            name: p.name,
            providerKey: p.providerKey,
            protocol: p.protocol,
            baseUrl: p.baseUrl,
            authorizeUrl: p.authorizeUrl,
            clientId: p.clientId,
            scopes: p.scopes || [],
            channelCode: p.channelCode,
        }));
    }

    /**
     * 方向B：已登录本地账号绑定 SSO 身份（SSO↔本地账号互认）。
     * 校验 code → 得外部身份 → 挂到当前已登录 User。
     */
    @Mutation()
    @Allow(Permission.Authenticated)
    async bindSsoIdentity(
        @Ctx() ctx: RequestContext,
        @Args('providerKey') providerKey: string,
        @Args('code') code: string,
        @Args('redirectUri', { nullable: true }) redirectUri?: string,
    ): Promise<{ bound: boolean; userId: string; identifier?: string; reason?: string }> {
        if (!ctx.activeUserId) {
            throw new ForbiddenError();
        }
        const config = readChannelAuthConfig(ctx);
        const provider = config?.ssoProviders?.find((p) => p.providerKey === providerKey) as SsoProvider | undefined;
        if (!provider) {
            return { bound: false, userId: String(ctx.activeUserId), reason: 'sso provider not configured' };
        }
        return ssoAuthenticationStrategy.bindIdentityToUser(ctx, provider, code, String(ctx.activeUserId), redirectUri);
    }
}
