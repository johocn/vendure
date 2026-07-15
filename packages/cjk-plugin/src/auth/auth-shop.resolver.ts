import { Resolver, Query } from '@nestjs/graphql';
import { RequestContext, Ctx } from '@vendure/core';
import { readChannelAuthConfig } from './crypto';
import type { SsoProviderInfo } from './auth-config.types';

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
}
