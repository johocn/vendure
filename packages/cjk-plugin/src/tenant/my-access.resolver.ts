import { Args, Query, Resolver, ID as GqlID } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, ChannelService, TransactionalConnection } from '@vendure/core';
import { Inject } from '@nestjs/common';
import { TenantMember } from './tenant-member.entity';

/**
 * 登录后返回当前后台用户的租户访问信息：
 * - channels：每个有权限的租户的启停状态（enabled）与该用户在该租户的人员启停（memberEnabled）
 * - permissions：当前用户在角色中累积的业务权限码（供前端菜单渲染）
 *   - 传入 channelId 时仅返回该 channel 对应角色限定的权限（按当前激活店铺渲染菜单），
 *     不传则返回跨 channel 并集（登录/选店阶段）。后端 API 授权由 ctx.userHasPermissions
 *     已按激活 channel 校验，此处仅影响前端菜单展示。
 */
@Resolver()
export class MyAccessResolver {
    constructor(
        @Inject(ChannelService) private channelService: ChannelService,
        @Inject(TransactionalConnection) private connection: TransactionalConnection,
    ) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myTenantAccess(
        @Ctx() ctx: RequestContext,
        @Args('channelId', { type: () => GqlID, nullable: true }) channelId?: string,
    ): Promise<any> {
        const user = (ctx as any).session?.user;
        // 超管判定不能依赖 ctx.userHasPermissions（按激活 channel 校验，superadmin 角色仅绑定 default
        // channel 时在其它租户下会误判为 false）。改用 User.superAdmin 原生标记 + 角色权限兜底，跨 channel 恒生效。
        const isSuperAdmin =
            user?.superAdmin === true ||
            (user?.roles || []).some(
                (r: any) =>
                    r.code === 'superadmin' ||
                    (r.permissions || []).includes(Permission.SuperAdmin),
            );

        // 当前用户可访问的 channel（Vendure 依据其角色）
        const me = await this.channelService.findAll(ctx, { take: 1000 });
        let channels: any[] = (me as any).items;

        if (!isSuperAdmin) {
            // 非超管：过滤到用户角色限定的 channel
            const userRoles = user?.roles || [];
            const roleChannelIds = new Set<string>();
            for (const r of userRoles) {
                for (const c of r.channels || []) roleChannelIds.add(String(c.id));
            }
            channels = channels.filter((c) => roleChannelIds.has(String(c.id)));
        }

        // 查询每个 channel 的启停 + 当前用户在其中的 TenantMember 启停
        const memberRepo = this.connection.getRepository(ctx, TenantMember);
        const memberRows = await memberRepo.find({ where: { administratorId: String(user?.id ?? '') } });
        const memberByChannel = new Map<string, TenantMember>();
        for (const m of memberRows) memberByChannel.set(String(m.channelId), m);

        const result = channels.map((c) => {
            const ccf = (c as any).customFields || {};
            const member = memberByChannel.get(String(c.id));
            return {
                id: String(c.id),
                code: c.code,
                token: c.token,
                name: cccName(c, ccf),
                enabled: ccf.enabled !== false,
                tenantNo: ccf.tenantNo ?? null,
                isOfficial: ccf.isOfficial === true,
                memberEnabled: isSuperAdmin ? true : (member ? member.enabled : true),
                mustChangePassword: isSuperAdmin ? false : (member ? member.mustChangePassword === true : false),
            };
        });

        // 权限码集合（前端菜单渲染用）：传 channelId 时仅取该 channel 对应角色的权限
        const permissions = new Set<string>();
        if (isSuperAdmin) {
            permissions.add(Permission.SuperAdmin);
        }
        for (const r of user?.roles || []) {
            // 角色是否覆盖指定 channel（未指定 channelId 时视为全部，即跨 channel 并集）
            const coversChannel =
                channelId === undefined || channelId === null || channelId === ''
                    ? true
                    : (r.channels || []).some((c: any) => String(c.id) === String(channelId));
            if (coversChannel) {
                for (const p of r.permissions || []) permissions.add(p);
            }
        }
        

        return {
            isSuperAdmin,
            channels: result,
            permissions: [...permissions],
            mustChangePassword: !isSuperAdmin && result.some((c) => c.mustChangePassword),
        };
    }
}

function cccName(c: any, ccf: any): string {
    return ccf.shopName || c.code;
}
