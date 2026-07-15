// e:\code\vendure\packages\cjk-plugin\src\auth\auth-shop.resolver.ts
import { Resolver, Query } from '@nestjs/graphql';
import { RequestContext, Ctx } from '@vendure/core';
import type { SsoProviderInfo } from './auth-config.types';

@Resolver()
export class AuthShopResolver {
    @Query()
    authMethods(@Ctx() ctx: RequestContext): string[] {
        const config = (ctx.channel as any)?.customFields?.authConfig;
        if (!config?.enabledMethods) {
            // 向后兼容：返回所有已注册策略
            return ['native', 'phone', 'wechat', 'alipay', 'douyin'];
        }
        return config.enabledMethods;
    }

    @Query()
    ssoProviders(@Ctx() ctx: RequestContext): SsoProviderInfo[] {
        const config = (ctx.channel as any)?.customFields?.authConfig;
        if (!config?.ssoProvidersJson) return [];
        try {
            const providers = JSON.parse(config.ssoProvidersJson);
            return providers.map((p: any) => ({
                name: p.name,
                providerKey: p.providerKey,
                protocol: p.protocol,
                baseUrl: p.baseUrl,
                authorizeUrl: p.authorizeUrl,
                clientId: p.clientId,
                scopes: p.scopes || [],
                channelCode: p.channelCode,
            }));
        } catch {
            return [];
        }
    }
}
