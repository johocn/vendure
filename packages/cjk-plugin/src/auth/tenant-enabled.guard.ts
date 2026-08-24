// 租户/人员启停强授权守卫（admin 端）
// 把「停用租户(customFields.enabled)」和「停用人员(TenantMember.enabled)」从前端 UI 语义升级为 API 强授权语义：
// 每个 admin 请求实时读库校验当前 channel 与当前人员是否启用，任一关闭即拒绝，绕开前端直接调 /admin-api 同样无效。
import { Injectable, ExecutionContext, CanActivate } from '@nestjs/common';
import { RequestContext, ForbiddenError, parseContext, internal_getRequestContext, Channel, TransactionalConnection, Permission } from '@vendure/core';
import { TenantMember } from '../tenant/tenant-member.entity';

@Injectable()
export class TenantEnabledGuard implements CanActivate {
    constructor(private connection: TransactionalConnection) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const parsed = parseContext(context);
        // 仅拦截 GraphQL admin 端请求；非 GraphQL 放行
        if (!parsed.isGraphQL) return true;
        const info = parsed.info;
        // 登录等无既有会话/渠道上下文的字段不拦截（ctx 未就绪由 Vendure 自行鉴权）
        if (!info) return true;

        const ctx = internal_getRequestContext(parsed.req);
        if (!ctx) return true;
        if (ctx.apiType !== 'admin') return true;

        const session = (ctx as any).session;
        const user = session?.user;
        if (!user || !user.id) return true; // 未登录由 Vendure 鉴权兜底，此处不误伤
        const channelId = (ctx as any).channelId;
        if (!channelId) return true;

        // 超管拥有全局管理权，不因某租户停用而被锁死
        if (ctx.userHasPermissions([Permission.SuperAdmin])) return true;

        // 实时读库校验租户是否启用
        const channelRepo = this.connection.getRepository(ctx, Channel);
        const channel = await channelRepo.findOne({ where: { id: channelId } as any });
        if (!channel) throw new ForbiddenError();
        if ((channel as any).customFields?.enabled === false) {
            throw new ForbiddenError();
        }

        // 实时读库校验当前人员在该租户是否启用（无关联记录视为放行，如 default 渠道的普通后台账号）
        const memberRepo = this.connection.getRepository(ctx, TenantMember);
        const member = await memberRepo.findOne({
            where: {
                administratorId: String(user.id),
                channelId: String(channelId),
            } as any,
        });
        if (member && member.enabled === false) {
            throw new ForbiddenError();
        }

        // 首登强改密：mustChangePassword=true 时，在完成改密前仅放行基础/改密操作，其余一律拒绝
        if (member && member.mustChangePassword === true) {
            const field = parsed.info.fieldName;
            const allowedAtForcedChange = new Set([
                'tenantChangeMyPassword', // 改密本身
                'myTenantAccess', // 登录后判断是否需要跳改密
                'me',
                'logout',
                'activeChannel',
            ]);
            if (!field || !allowedAtForcedChange.has(field)) {
                throw new ForbiddenError();
            }
        }

        return true;
    }
}