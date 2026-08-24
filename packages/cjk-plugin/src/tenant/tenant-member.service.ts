import { Injectable } from '@nestjs/common';
import {
    Administrator,
    AdministratorService,
    ChannelService,
    ID,
    Logger,
    Permission,
    RequestContext,
    Role,
    RoleService,
    TransactionalConnection,
} from '@vendure/core';
import { loggerCtx } from '../constants';
import { TenantMember } from './tenant-member.entity';

/** 租户级角色可用的业务权限白名单（不含超管专属权限；Vendure v3 已将 Variant/Fulfillment 等合并进 catalog/product/order 权限） */
export const BUSINESS_PERMISSIONS: string[] = [
    Permission.ReadCatalog,
    Permission.CreateCatalog,
    Permission.UpdateCatalog,
    Permission.DeleteCatalog,
    Permission.ReadProduct,
    Permission.CreateProduct,
    Permission.UpdateProduct,
    Permission.DeleteProduct,
    Permission.ReadCollection,
    Permission.CreateCollection,
    Permission.UpdateCollection,
    Permission.DeleteCollection,
    Permission.ReadOrder,
    Permission.UpdateOrder,
    Permission.CreateOrder,
    Permission.ReadAsset,
    Permission.CreateAsset,
    Permission.UpdateAsset,
    Permission.DeleteAsset,
    Permission.ReadShippingMethod,
    Permission.CreateShippingMethod,
    Permission.UpdateShippingMethod,
    Permission.DeleteShippingMethod,
    Permission.ReadPaymentMethod,
    Permission.CreatePaymentMethod,
    Permission.UpdatePaymentMethod,
    Permission.DeletePaymentMethod,
    Permission.ReadChannel,
    Permission.UpdateChannel,
    Permission.ReadAdministrator,
    Permission.UpdateAdministrator,
    'TenantRoleManage',
    'TenantMemberManage',
    'VerifyOrder',
].map(String);

export interface CreateTenantAdminInput {
    firstName?: string;
    lastName?: string;
    emailAddress: string;
    password?: string;
    roleIds: ID[];
    displayName?: string;
    remark?: string;
    enabled?: boolean;
}

@Injectable()
export class TenantMemberService {
    constructor(
        private connection: TransactionalConnection,
        private administratorService: AdministratorService,
        private roleService: RoleService,
        private channelService: ChannelService,
    ) {}

    /** 校验角色权限全部在业务权限白名单内（超管专属权限不入租户角色） */
    assertBusinessPermissions(permissions: string[]): void {
        const invalid = permissions.filter((p) => !BUSINESS_PERMISSIONS.includes(p));
        if (invalid.length > 0) {
            throw new Error(`FORBIDDEN_PERMISSION: ${invalid.join(',')} 为超管专属权限`);
        }
    }

    /** 校验请求方是该 channel 的租户管理员（或超管） */
    assertChannelMember(ctx: RequestContext, channelId?: ID): void {
        if (ctx.userHasPermissions([Permission.SuperAdmin])) return;
        const target = channelId != null ? String(channelId) : String(ctx.channelId);
        const perms = (ctx as any).session?.user?.channelPermissions || [];
        const ok = perms.some((c: any) => String(c.id) === target);
        if (!ok) throw new Error('CHANNEL_FORBIDDEN');
    }

    /** 安全加固：校验目标角色必须属于指定 channel，防止跨租户改/删任意角色（横向越权） */
    async assertRoleInChannel(ctx: RequestContext, roleId: ID, channelId: ID): Promise<void> {
        const roleRepo = this.connection.getRepository(ctx, Role);
        const role = await roleRepo.findOne({ where: { id: roleId } as any, relations: ['channels'] });
        if (!role) throw new Error('ROLE_NOT_FOUND');
        const belongs = (role.channels || []).some((c) => String((c as any).id) === String(channelId));
        if (!belongs) throw new Error('CHANNEL_FORBIDDEN');
    }

    /** 安全加固：校验待绑定角色全部属于指定 channel，防止租户管理员绑定别店角色提权 */
    async assertRolesInChannel(ctx: RequestContext, roleIds: ID[], channelId: ID): Promise<void> {
        for (const roleId of roleIds) {
            await this.assertRoleInChannel(ctx, roleId, channelId);
        }
    }

    /** 建租户（Channel）——仅超管调用 */
    async createChannel(
        ctx: RequestContext,
        input: { code: string; token?: string; name: string; tenantNo?: number; isOfficial?: boolean },
    ): Promise<any> {
        const channel = await this.channelService.create(ctx, {
            code: input.code,
            token: input.token,
            defaultLanguageCode: 'zh_Hans' as any,
            currencyCode: 'CNY' as any,
            pricesIncludeTax: true,
            customFields: {
                tenantNo: input.tenantNo ?? null,
                isOfficial: input.isOfficial ?? false,
                enabled: true,
                shopName: input.name,
            },
        } as any);
        Logger.info(`已创建租户 ${input.code}`, loggerCtx);
        return channel;
    }

    /** 租户启停（仅超管） */
    async setChannelEnabled(ctx: RequestContext, channelId: ID, enabled: boolean): Promise<void> {
        await this.channelService.update(ctx, {
            id: channelId,
            customFields: { enabled },
        } as any);
    }

    /** 更新租户基础信息（仅超管） */
    async updateChannel(
        ctx: RequestContext,
        channelId: ID,
        input: { name?: string; tenantNo?: number; isOfficial?: boolean },
    ): Promise<void> {
        await this.channelService.update(ctx, {
            id: channelId,
            customFields: {
                tenantNo: input.tenantNo,
                isOfficial: input.isOfficial,
            },
        } as any);
    }

    /** 租户级角色创建（限定 channelIds=[channelId]；权限白名单校验） */
    async createTenantRole(ctx: RequestContext, channelId: ID, input: { code: string; description: string; permissions: string[] }): Promise<any> {
        this.assertBusinessPermissions(input.permissions);
        return this.roleService.create(ctx, {
            code: input.code,
            description: input.description,
            permissions: input.permissions as Permission[],
            channelIds: [channelId],
        });
    }

    /** 租户级角色更新（权限白名单校验；channelId 非空时校验角色归属，防横向越权） */
    async updateTenantRole(
        ctx: RequestContext,
        roleId: ID,
        input: { code?: string; description?: string; permissions?: string[] },
        channelId?: ID,
    ): Promise<any> {
        if (channelId != null) await this.assertRoleInChannel(ctx, roleId, channelId);
        if (input.permissions) this.assertBusinessPermissions(input.permissions);
        return this.roleService.update(ctx, {
            id: roleId,
            code: input.code,
            description: input.description,
            permissions: input.permissions as Permission[],
        });
    }

    /** 租户级角色删除（channelId 非空时校验角色归属，防横向越权） */
    async deleteTenantRole(ctx: RequestContext, roleId: ID, channelId?: ID): Promise<void> {
        if (channelId != null) await this.assertRoleInChannel(ctx, roleId, channelId);
        await this.roleService.delete(ctx, roleId);
    }

    /** 超管为租户建管理员账号并绑定角色，同时写入 TenantMember */
    async createTenantAdministrator(ctx: RequestContext, channelId: ID, input: CreateTenantAdminInput): Promise<TenantMember> {
        if (input.roleIds && input.roleIds.length > 0) {
            await this.assertRolesInChannel(ctx, input.roleIds, channelId);
        }
        const admin = await this.administratorService.create(ctx, {
            firstName: input.firstName ?? '',
            lastName: input.lastName ?? input.emailAddress,
            emailAddress: input.emailAddress,
            password: input.password,
            roleIds: input.roleIds,
        } as any);
        const repo = this.connection.getRepository(ctx, TenantMember);
        const member = new TenantMember();
        member.administratorId = String(admin.id);
        member.channelId = String(channelId);
        member.enabled = input.enabled ?? true;
        member.displayName = input.displayName ?? input.emailAddress;
        member.remark = input.remark ?? null;
        await repo.save(member);
        return member;
    }

    /** 租户人员启停 */
    async setMemberEnabled(ctx: RequestContext, channelId: ID, memberId: ID, enabled: boolean): Promise<void> {
        const repo = this.connection.getRepository(ctx, TenantMember);
        const member = await repo.findOne({ where: { id: memberId, channelId: String(channelId) } });
        if (!member) throw new Error('MEMBER_NOT_FOUND');
        member.enabled = enabled;
        await repo.save(member);
    }

    /** 租户人员移除（仅删 TenantMember 关联，Administrator 本体保留） */
    async removeMember(ctx: RequestContext, channelId: ID, memberId: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, TenantMember);
        const member = await repo.findOne({ where: { id: memberId, channelId: String(channelId) } });
        if (!member) throw new Error('MEMBER_NOT_FOUND');
        await repo.remove(member);
    }
}
