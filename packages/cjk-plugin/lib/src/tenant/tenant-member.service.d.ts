import { AdministratorService, ChannelService, ID, RequestContext, RoleService, TransactionalConnection } from '@vendure/core';
import type { CjkPluginOptions } from '../types';
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
/** 全局角色 code 前缀：超管建的全局角色统一加此前缀，用于池查询与全局/本地判定（Vendure Role 无 customFields，用前缀区分） */
export declare const GLOBAL_ROLE_PREFIX = "g-";
/** 全局角色 code 规范化：输入 code 自动统一为 `g-{code}`，避免手动误输入前缀产生重复 */
export declare function normalizeGlobalRoleCode(code: string): string;
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
/** 租户管理人密码重置的默认口令（超管在租户详情页「重置密码」时写回此值） */
export declare const DEFAULT_ADMIN_PASSWORD = "you123123";
export declare class TenantMemberService {
    private connection;
    private administratorService;
    private roleService;
    private channelService;
    private pluginOptions?;
    constructor(connection: TransactionalConnection, administratorService: AdministratorService, roleService: RoleService, channelService: ChannelService, pluginOptions?: CjkPluginOptions | undefined);
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
    /** 更新租户基础信息（仅超管）：name → shopName；domain → 默认外网域名。合并既有 customFields，仅覆盖传入字段。 */
    updateChannel(ctx: RequestContext, channelId: ID, input: {
        name?: string;
        tenantNo?: number;
        isOfficial?: boolean;
        domain?: string;
    }): Promise<void>;
    /** 租户级角色创建（限定 channelIds=[channelId]；权限白名单校验） */
    createTenantRole(ctx: RequestContext, channelId: ID, input: {
        code: string;
        description: string;
        permissions: string[];
    }): Promise<any>;
    /** 判断指定 channel 是否已存在该 code 的关联角色（幂等判定）。 */
    private roleExistsInChannel;
    /** 按 channelId 直查该租户全部角色（绕过 roleService.findAll 的「当前用户在目标 channel 需拥有全部权限」过滤，
     *  否则超管在未绑定的 channerl 上会读不到该租户任何角色）。 */
    rolesForChannel(ctx: RequestContext, channelId: ID): Promise<any[]>;
    /** 系统直建租户级角色（绕过 roleService.create 的权限校验，仅用于启动补种子/一键导入这类系统操作）。
     *  幂等：仅当该 code 在本 channel 不存在时才创建。 */
    private createTenantRoleDirect;
    /** 建全局角色并批量分发到店：code 自动加 `g-` 前缀；channelIds 为空 → channels=[]（全局可用），非空 → channels=[勾选店]（全局默认）。
     *  统一幂等：code 已存在则仅追加缺失店，绝不重复关联同一店。所有加店路径（创建时勾选/分发/引用）均应收敛到此核心语义。 */
    createGlobalRoleWithChannels(ctx: RequestContext, channelIds: ID[], input: {
        code: string;
        description: string;
        permissions: string[];
    }): Promise<any[]>;
    /** 直建全局可用角色（channels=[]）。空 channelIds 走 createGlobalRoleWithChannels；保持幂等语义。 */
    createGlobalRoleDirect(ctx: RequestContext, input: {
        code: string;
        description: string;
        permissions: string[];
    }): Promise<any>;
    /** 把全局角色引用到某店（幂等：已含该店则 no-op；仅 g- 前缀全局角色允许被引用，租户本地角色不可引）。
     *  超管从池继续分发也已含本方法，故去掉原「channels 必须为空」限制，允许多店分发。 */
    referGlobalRoleToChannel(ctx: RequestContext, roleId: ID, channelId: ID): Promise<void>;
    /** 取消某店对该全局角色的引用（移除该店；channels 变空则回到全局池）。 */
    unreferGlobalRoleFromChannel(ctx: RequestContext, roleId: ID, channelId: ID): Promise<void>;
    /** 租户自助：引用全局角色到当前 ctx.channelId。仅允许引用「未绑定任何店」的 g- 角色（channels=[]），
     *  防止租户引用已被他店绑定（channels 非空）的角色造成跨店共享越权。 */
    myReferGlobalRole(ctx: RequestContext, roleId: ID): Promise<void>;
    /** 租户自助可引用列表：仅返回「未绑定任何店」的 g- 角色（channels=[]，可引用）。 */
    globalRolesAvailable(ctx: RequestContext): Promise<any[]>;
    /** 租户自助：从当前 ctx.channelId 取消引用。 */
    myUnreferGlobalRole(ctx: RequestContext, roleId: ID): Promise<void>;
    /** 查全部全局角色（code 以 g- 开头；channels 可为空=全局可用，非空=已分发到店）。 */
    globalRoles(ctx: RequestContext): Promise<any[]>;
    /** 全局默认角色模板（不落库为 Role）：租户"导入到本店"时复制独立副本，各租户权限互不影响 */
    globalRoleTemplates(ctx: RequestContext): Promise<any[]>;
    /** 单租户一键导入默认三角色（幂等）。已初始化则返回空数组，不重复建。 */
    importDefaultRoles(ctx: RequestContext, channelId: ID): Promise<any[]>;
    /** 租户自助：从全局默认模板复制独立副本到当前 ctx.channelId（幂等，复用 importDefaultRoles） */
    myImportDefaultRoles(ctx: RequestContext): Promise<any[]>;
    /** 启动补种子：扫描所有 Channel，缺默认角色则幂等补建；异常仅打日志不阻塞启动。 */
    ensureDefaultRolesForAllChannels(ctx: RequestContext): Promise<void>;
    /** 把指定渠道关联到超管角色（幂等）——超管全局豁免渠道校验的核心：superadmin 角色须覆盖所有渠道，
     *  否则超管切到未绑定角色渠道时 Vendure 权限守卫无任何权限，无法在租户内发商品/提审等操作。 */
    ensureSuperAdminRoleCoversChannel(ctx: RequestContext, channelId: ID): Promise<void>;
    /** 把所有存量渠道补关联到超管角色（幂等；失败仅打日志不阻塞启动） */
    ensureSuperAdminRoleCoversAllChannels(ctx: RequestContext): Promise<void>;
    /** 把指定渠道列表关联到超管角色（幂等：已含则 no-op）。superadmin 角色自带 SuperAdmin 权限，
     *  一旦覆盖某渠道，userHasPermissions(Permission.SuperAdmin) 在该渠道即返回 true，实现超管全局豁免。 */
    private ensureSuperAdminRoleCoversChannels;
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
    /** 超管重置租户管理人密码为默认口令 you123123，并清除该人员的首登强改密标志（可用默认口令直接登录） */
    resetAdminPassword(ctx: RequestContext, memberId: ID): Promise<TenantMember>;
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
