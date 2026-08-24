import { AdministratorService, ChannelService, ID, RequestContext, RoleService, TransactionalConnection } from '@vendure/core';
import { TenantMember } from './tenant-member.entity';
export interface PermissionCatalogItem {
    code: string;
    label: string;
}
export interface PermissionCatalogGroup {
    key: string;
    label: string;
    items: PermissionCatalogItem[];
}
/**
 * 租户级业务权限目录（单一来源，前后端共用，避免双份硬编码）。
 * 不含超管专属权限；Vendure v3 已将 Variant/Fulfillment 等合并进 catalog/product/order 权限。
 * 前端角色管理页通过 permissionCatalog 查询动态渲染，BUSINESS_PERMISSIONS 由此扁平派生。
 */
export declare const PERMISSION_CATALOG: PermissionCatalogGroup[];
/** 租户级角色可用的业务权限白名单（由 PERMISSION_CATALOG 扁平派生，建模/校验统一使用） */
export declare const BUSINESS_PERMISSIONS: string[];
export interface CreateTenantAdminInput {
    firstName?: string;
    lastName?: string;
    emailAddress: string;
    password?: string;
    roleIds: ID[];
    displayName?: string;
    remark?: string;
    phone?: string;
    enabled?: boolean;
    /** 强制首登改密（默认：未显式传 password 时为 true；显式传 password 时为 false） */
    forcePasswordChange?: boolean;
}
/** 生成随机强口令：≥10 位，保证大小写/数字/符号各类至少一个 */
export declare function randomStrongPassword(length?: number): string;
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
    /** 新建租户：自动分配 tenantNo（当前最大+1），code 由 tenantNo 派生 `t{tenantNo}`，避免手输冲突 */
    createChannel(ctx: RequestContext, input: {
        name: string;
        token?: string;
        isOfficial?: boolean;
    }): Promise<any>;
    /** 取当前最大 tenantNo，自增 1；无数据时从 0 开始（第 1 个租户得到 1）。
     *  用 TypeORM 原生 read 绕开 channelService.findAll 的 take≤1000 限制（否则新建租户必报「查询结果大于1000」）。 */
    private nextTenantNo;
    /** 租户启停（仅超管） */
    setChannelEnabled(ctx: RequestContext, channelId: ID, enabled: boolean): Promise<void>;
    /** 更新租户基础信息（仅超管）：name → shopName 一并写入 */
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
    /** 判断指定 channel 是否已存在该 code 的关联角色（幂等判定）。 */
    private roleExistsInChannel;
    /** 单租户一键导入默认三角色（幂等）。已初始化则返回空数组，不重复建。 */
    importDefaultRoles(ctx: RequestContext, channelId: ID): Promise<any[]>;
    /** 启动补种子：扫描所有 Channel，缺默认角色则幂等补建；异常仅打日志不阻塞启动。 */
    ensureDefaultRolesForAllChannels(ctx: RequestContext): Promise<void>;
    /** 租户级角色更新（权限白名单校验；channelId 非空时校验角色归属，防横向越权） */
    updateTenantRole(ctx: RequestContext, roleId: ID, input: {
        code?: string;
        description?: string;
        permissions?: string[];
    }, channelId?: ID): Promise<any>;
    /** 租户级角色删除（channelId 非空时校验角色归属，防横向越权） */
    deleteTenantRole(ctx: RequestContext, roleId: ID, channelId?: ID): Promise<void>;
    /** 更换某人员在该租户内的角色：归属 + 白名单 + 横向越权三重校验 */
    updateTenantMemberRoles(ctx: RequestContext, channelId: ID, memberId: ID, roleIds: ID[]): Promise<void>;
    /** 以「合并」语义同步某管理员在本 channel 的角色：仅替换本租户角色，保留其在其它租户的角色（跨店任职互不影响） */
    syncMemberRolesInChannel(ctx: RequestContext, administratorId: ID, channelId: ID, roleIds: ID[]): Promise<void>;
    /** 返回人员在当前租户内的角色 id（用于改角色弹层回显勾选） */
    memberRoleIdsInChannel(ctx: RequestContext, member: TenantMember): Promise<ID[]>;
    /** 将 TenantMember 组装为含 roleIds 的视图对象（供列表查询直接返回，避免依赖 @ResolveField 子解析造成非空字段 null 报错） */
    memberToView(ctx: RequestContext, member: TenantMember): Promise<any>;
    /** 超管为租户建管理员账号并绑定角色，同时写入 TenantMember */
    createTenantAdministrator(ctx: RequestContext, channelId: ID, input: CreateTenantAdminInput): Promise<TenantMember>;
    /** 当前登录者修改自身密码：更新 Administrator 密码，并清除其所有租户关联的首登强改密标志 */
    changeMyPassword(ctx: RequestContext, newPassword: string): Promise<void>;
    /** 租户人员启停 */
    setMemberEnabled(ctx: RequestContext, channelId: ID, memberId: ID, enabled: boolean): Promise<void>;
    /** 租户人员移除（仅删 TenantMember 关联，Administrator 本体保留） */
    removeMember(ctx: RequestContext, channelId: ID, memberId: ID): Promise<void>;
    /** 搜索后台账号（按邮箱/姓氏模糊匹配），返回各账号在租户内的关联统计，供「关联已有账号进租户」选择 */
    searchAdmins(ctx: RequestContext, channelId: ID, keyword?: string, take?: number): Promise<any[]>;
    /** 将既有后台账号关联进某租户（写入 TenantMember 并合并绑定本租户角色）；若已在该租户则报错 */
    linkMember(ctx: RequestContext, channelId: ID, input: {
        administratorId: ID;
        roleIds?: ID[];
        enabled?: boolean;
        displayName?: string;
        phone?: string;
        remark?: string;
    }): Promise<any>;
    /** 租户管理员更新「本 channel」装修类 customFields（仅覆盖传入字段，禁止触碰安全字段） */
    updateMyChannelCustomFields(ctx: RequestContext, input?: Record<string, any>): Promise<any>;
}
