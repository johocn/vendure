import { AdministratorService, ChannelService, ID, RequestContext, RoleService, TransactionalConnection } from '@vendure/core';
import { TenantMember } from './tenant-member.entity';
/** 租户级角色可用的业务权限白名单（不含超管专属权限；Vendure v3 已将 Variant/Fulfillment 等合并进 catalog/product/order 权限） */
export declare const BUSINESS_PERMISSIONS: string[];
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
export declare class TenantMemberService {
    private connection;
    private administratorService;
    private roleService;
    private channelService;
    constructor(connection: TransactionalConnection, administratorService: AdministratorService, roleService: RoleService, channelService: ChannelService);
    /** 校验角色权限全部在业务权限白名单内（超管专属权限不入租户角色） */
    assertBusinessPermissions(permissions: string[]): void;
    /** 校验请求方是该 channel 的租户管理员（或超管） */
    assertChannelMember(ctx: RequestContext, channelId?: ID): void;
    /** 安全加固：校验目标角色必须属于指定 channel，防止跨租户改/删任意角色（横向越权） */
    assertRoleInChannel(ctx: RequestContext, roleId: ID, channelId: ID): Promise<void>;
    /** 安全加固：校验待绑定角色全部属于指定 channel，防止租户管理员绑定别店角色提权 */
    assertRolesInChannel(ctx: RequestContext, roleIds: ID[], channelId: ID): Promise<void>;
    /** 建租户（Channel）——仅超管调用 */
    createChannel(ctx: RequestContext, input: {
        code: string;
        token?: string;
        name: string;
        tenantNo?: number;
        isOfficial?: boolean;
    }): Promise<any>;
    /** 租户启停（仅超管） */
    setChannelEnabled(ctx: RequestContext, channelId: ID, enabled: boolean): Promise<void>;
    /** 更新租户基础信息（仅超管） */
    updateChannel(ctx: RequestContext, channelId: ID, input: {
        name?: string;
        tenantNo?: number;
        isOfficial?: boolean;
    }): Promise<void>;
    /** 租户级角色创建（限定 channelIds=[channelId]；权限白名单校验） */
    createTenantRole(ctx: RequestContext, channelId: ID, input: {
        code: string;
        description: string;
        permissions: string[];
    }): Promise<any>;
    /** 租户级角色更新（权限白名单校验；channelId 非空时校验角色归属，防横向越权） */
    updateTenantRole(ctx: RequestContext, roleId: ID, input: {
        code?: string;
        description?: string;
        permissions?: string[];
    }, channelId?: ID): Promise<any>;
    /** 租户级角色删除（channelId 非空时校验角色归属，防横向越权） */
    deleteTenantRole(ctx: RequestContext, roleId: ID, channelId?: ID): Promise<void>;
    /** 超管为租户建管理员账号并绑定角色，同时写入 TenantMember */
    createTenantAdministrator(ctx: RequestContext, channelId: ID, input: CreateTenantAdminInput): Promise<TenantMember>;
    /** 租户人员启停 */
    setMemberEnabled(ctx: RequestContext, channelId: ID, memberId: ID, enabled: boolean): Promise<void>;
    /** 租户人员移除（仅删 TenantMember 关联，Administrator 本体保留） */
    removeMember(ctx: RequestContext, channelId: ID, memberId: ID): Promise<void>;
}
