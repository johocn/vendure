import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, RoleService, TransactionalConnection } from '@vendure/core';
import { Inject } from '@nestjs/common';
import { TenantMemberService } from './tenant-member.service';
import { TenantMember } from './tenant-member.entity';
import { tenantMemberManagePermission, tenantRoleManagePermission } from './tenant-permissions';

/**
 * 租户管理员 API：所有操作强制限定在 ctx.channelId（当前请求租户）。
 */
@Resolver()
export class TenantMemberResolver {
    constructor(
        @Inject(RoleService) private roleService: RoleService,
        @Inject(TransactionalConnection) private connection: TransactionalConnection,
        @Inject(TenantMemberService) private tenantMemberService: TenantMemberService,
    ) {}

    @Query()
    @Allow(Permission.Authenticated)
    async tenantMembers(@Ctx() ctx: RequestContext): Promise<TenantMember[]> {
        this.tenantMemberService.assertChannelMember(ctx);
        const repo = this.connection.getRepository(ctx, TenantMember);
        return repo.find({ where: { channelId: String(ctx.channelId) }, order: { createdAt: 'ASC' } });
    }

    @Mutation()
    @Allow(tenantMemberManagePermission.Permission)
    async createTenantMember(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: any },
    ): Promise<TenantMember> {
        this.tenantMemberService.assertChannelMember(ctx);
        return this.tenantMemberService.createTenantAdministrator(ctx, ctx.channelId, args.input);
    }

    @Mutation()
    @Allow(tenantMemberManagePermission.Permission)
    async setTenantMemberEnabled(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; enabled: boolean },
    ): Promise<TenantMember> {
        this.tenantMemberService.assertChannelMember(ctx);
        await this.tenantMemberService.setMemberEnabled(ctx, ctx.channelId, args.id, args.enabled);
        const repo = this.connection.getRepository(ctx, TenantMember);
        return repo.findOne({ where: { id: args.id } } as any) as any;
    }

    @Mutation()
    @Allow(tenantMemberManagePermission.Permission)
    async deleteTenantMember(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<boolean> {
        this.tenantMemberService.assertChannelMember(ctx);
        await this.tenantMemberService.removeMember(ctx, ctx.channelId, id);
        return true;
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myTenantRoles(@Ctx() ctx: RequestContext): Promise<any[]> {
        this.tenantMemberService.assertChannelMember(ctx);
        const result = await this.roleService.findAll(ctx);
        const chId = String(ctx.channelId);
        return (result as any).items.filter((r: any) => (r.channels || []).some((c: any) => String(c.id) === chId));
    }

    @Mutation()
    @Allow(tenantRoleManagePermission.Permission)
    async myCreateTenantRole(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: { code: string; description: string; permissions: string[] } },
    ): Promise<any> {
        this.tenantMemberService.assertChannelMember(ctx);
        return this.tenantMemberService.createTenantRole(ctx, ctx.channelId, args.input);
    }

    @Mutation()
    @Allow(tenantRoleManagePermission.Permission)
    async myUpdateTenantRole(
        @Ctx() ctx: RequestContext,
        @Args() args: { roleId: string; input: any },
    ): Promise<any> {
        this.tenantMemberService.assertChannelMember(ctx);
        return this.tenantMemberService.updateTenantRole(ctx, args.roleId, args.input, ctx.channelId);
    }

    @Mutation()
    @Allow(tenantRoleManagePermission.Permission)
    async myDeleteTenantRole(@Ctx() ctx: RequestContext, @Args('roleId') roleId: string): Promise<boolean> {
        this.tenantMemberService.assertChannelMember(ctx);
        await this.tenantMemberService.deleteTenantRole(ctx, roleId, ctx.channelId);
        return true;
    }
}
