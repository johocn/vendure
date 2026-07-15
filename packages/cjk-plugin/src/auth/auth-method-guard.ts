// e:\code\vendure\packages\cjk-plugin\src\auth\auth-method-guard.ts
import { Injectable, ExecutionContext, CanActivate } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RequestContext, ForbiddenError, parseContext, internal_getRequestContext } from '@vendure/core';
import type { AuthMethod, TenantAuthConfig } from './auth-config.types';

export function isAuthMethodEnabled(ctx: RequestContext, method: AuthMethod): boolean {
    const config = (ctx.channel as any)?.customFields?.authConfig;
    if (!config) return true; // 向后兼容：未配置时所有策略启用
    return (config.enabledMethods || []).includes(method);
}

@Injectable()
export class AuthMethodGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const parsed = parseContext(context);
        if (!parsed.isGraphQL) return true;

        const info = parsed.info;
        if (!info || info.fieldName !== 'authenticate') return true;

        // 用 internal_getRequestContext 取 RequestContext（Vendure AuthGuard 已写入）
        const ctx = internal_getRequestContext(parsed.req);
        if (!ctx) return true; // 无 ctx 降级放行

        // 仅拦截 shop 端，admin 端不受影响（防止管理员锁死）
        if (ctx.apiType !== 'shop') return true;

        const gqlCtx = GqlExecutionContext.create(context);
        const args = gqlCtx.getArgs();
        if (!args?.input) return true;

        // AuthenticationInput 是 map: { native?: {...}, phone?: {...}, sso?: {...} }
        const method = Object.keys(args.input)[0] as AuthMethod;
        if (!method) return true;

        if (!isAuthMethodEnabled(ctx, method)) {
            throw new ForbiddenError();
        }
        return true;
    }
}
