import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, ChannelService, RoleService, TransactionalConnection } from '@vendure/core';
import { Inject } from '@nestjs/common';
import { TenantMemberService } from './tenant-member.service';
import { TenantMember } from './tenant-member.entity';

@Resolver()
export class TenantAdminResolver {
    constructor(
        @Inject(ChannelService) private channelService: ChannelService,
        @Inject(RoleService) private roleService: RoleService,
        @Inject(TransactionalConnection) private connection: TransactionalConnection,
        @Inject(TenantMemberService) private tenantMemberService: TenantMemberService,
    ) {}

    @Query()
    @Allow(Permission.SuperAdmin)
    async tenants(
        @Ctx() ctx: RequestContext,
        @Args() args: { options: { skip?: number; take?: number; filter?: any } },
    ): Promise<{ items: any[]; totalItems: number }> {
        const result = await this.channelService.findAll(ctx, {
            skip: args.options?.skip ?? 0,
            take: args.options?.take ?? 50,
        });
        return result as any;
    }

    @Query()
    @Allow(Permission.SuperAdmin)
    async tenant(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<any> {
        return this.channelService.findOne(ctx, id as any);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async createTenant(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: { name: string; token?: string; isOfficial?: boolean } },
    ): Promise<any> {
        return this.tenantMemberService.createChannel(ctx, args.input);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async updateTenant(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; input: { name?: string; tenantNo?: number; isOfficial?: boolean } },
    ): Promise<any> {
        await this.tenantMemberService.updateChannel(ctx, args.id, args.input);
        return this.channelService.findOne(ctx, args.id as any);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async setTenantEnabled(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; enabled: boolean },
    ): Promise<any> {
        await this.tenantMemberService.setChannelEnabled(ctx, args.id, args.enabled);
        return this.channelService.findOne(ctx, args.id as any);
    }

    /** 软删：标记停用，不做物理删除 */
    @Mutation()
    @Allow(Permission.SuperAdmin)
    async deleteTenant(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<boolean> {
        await this.tenantMemberService.setChannelEnabled(ctx, id, false);
        return true;
    }

    @Query()
    @Allow(Permission.SuperAdmin)
    async tenantAdministrators(
        @Ctx() ctx: RequestContext,
        @Args('channelId') channelId: string,
    ): Promise<TenantMember[]> {
        const repo = this.connection.getRepository(ctx, TenantMember);
        const members = await repo.find({ where: { channelId }, order: { createdAt: 'ASC' } });
        return Promise.all(members.map((m) => this.tenantMemberService.memberToView(ctx, m))) as Promise<any[]>;
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async createTenantAdministrator(
        @Ctx() ctx: RequestContext,
        @Args() args: { channelId: string; input: any },
    ): Promise<TenantMember> {
        return this.tenantMemberService.createTenantAdministrator(ctx, args.channelId, args.input);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async setTenantAdministratorEnabled(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; enabled: boolean },
    ): Promise<TenantMember> {
        const repo = this.connection.getRepository(ctx, TenantMember);
        const member = await repo.findOne({ where: { id: args.id } });
        if (!member) throw new Error('MEMBER_NOT_FOUND');
        await this.tenantMemberService.setMemberEnabled(ctx, member.channelId, args.id, args.enabled);
        return repo.findOne({ where: { id: args.id } } as any) as any;
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async deleteTenantAdministrator(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, TenantMember);
        const member = await repo.findOne({ where: { id } });
        if (!member) throw new Error('MEMBER_NOT_FOUND');
        await this.tenantMemberService.removeMember(ctx, member.channelId, id);
        return true;
    }

    @Query()
    @Allow(Permission.SuperAdmin)
    async tenantRoles(@Ctx() ctx: RequestContext, @Args('channelId') channelId: string): Promise<any[]> {
        const result = await this.roleService.findAll(ctx);
        const chId = String(channelId);
        return (result as any).items.filter((r: any) => (r.channels || []).some((c: any) => String(c.id) === chId));
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async createTenantRole(
        @Ctx() ctx: RequestContext,
        @Args() args: { channelId: string; input: { code: string; description: string; permissions: string[] } },
    ): Promise<any> {
        return this.tenantMemberService.createTenantRole(ctx, args.channelId, args.input);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async updateTenantRole(
        @Ctx() ctx: RequestContext,
        @Args() args: { roleId: string; input: { code?: string; description?: string; permissions?: string[] } },
    ): Promise<any> {
        return this.tenantMemberService.updateTenantRole(ctx, args.roleId, args.input);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async deleteTenantRole(@Ctx() ctx: RequestContext, @Args('roleId') roleId: string): Promise<boolean> {
        await this.tenantMemberService.deleteTenantRole(ctx, roleId);
        return true;
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async updateTenantMemberRoles(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; channelId: string; roleIds: string[] },
    ): Promise<boolean> {
        await this.tenantMemberService.updateTenantMemberRoles(ctx, args.channelId, args.id, args.roleIds);
        return true;
    }

    @Query()
    @Allow(Permission.SuperAdmin)
    async tenantSearchAdmins(
        @Ctx() ctx: RequestContext,
        @Args() args: { channelId: string; keyword?: string },
    ): Promise<any[]> {
        return this.tenantMemberService.searchAdmins(ctx, args.channelId, args.keyword, 10);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async tenantLinkMember(
        @Ctx() ctx: RequestContext,
        @Args() args: {
            channelId: string;
            administratorId: string;
            roleIds?: string[];
            displayName?: string;
            phone?: string;
            remark?: string;
        },
    ): Promise<any> {
        return this.tenantMemberService.linkMember(ctx, args.channelId, {
            administratorId: args.administratorId,
            roleIds: args.roleIds,
            displayName: args.displayName,
            phone: args.phone,
            remark: args.remark,
        });
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async importDefaultRoles(
        @Ctx() ctx: RequestContext,
        @Args('channelId') channelId: string,
    ): Promise<any[]> {
        return this.tenantMemberService.importDefaultRoles(ctx, channelId);
    }
}
