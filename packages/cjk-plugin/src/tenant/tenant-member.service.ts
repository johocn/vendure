import { Injectable } from '@nestjs/common';
import {
    Administrator,
    AdministratorService,
    Channel,
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
import { OFFICIAL_ROLE_TEMPLATES } from './role-templates';

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
export const PERMISSION_CATALOG: PermissionCatalogGroup[] = [
    {
        key: 'catalog',
        label: '商品/目录',
        items: [
            { code: Permission.ReadCatalog, label: '目录·读' },
            { code: Permission.CreateCatalog, label: '目录·增' },
            { code: Permission.UpdateCatalog, label: '目录·改' },
            { code: Permission.DeleteCatalog, label: '目录·删' },
            { code: Permission.ReadProduct, label: '商品·读' },
            { code: Permission.CreateProduct, label: '商品·增' },
            { code: Permission.UpdateProduct, label: '商品·改' },
            { code: Permission.DeleteProduct, label: '商品·删' },
        ],
    },
    {
        key: 'collection',
        label: '分类',
        items: [
            { code: Permission.ReadCollection, label: '分类·读' },
            { code: Permission.CreateCollection, label: '分类·增' },
            { code: Permission.UpdateCollection, label: '分类·改' },
            { code: Permission.DeleteCollection, label: '分类·删' },
        ],
    },
    {
        key: 'order',
        label: '订单',
        items: [
            { code: Permission.ReadOrder, label: '订单·读' },
            { code: Permission.UpdateOrder, label: '订单·改' },
            { code: Permission.CreateOrder, label: '订单·建' },
        ],
    },
    {
        key: 'asset',
        label: '图片',
        items: [
            { code: Permission.ReadAsset, label: '图片·读' },
            { code: Permission.CreateAsset, label: '图片·传' },
            { code: Permission.UpdateAsset, label: '图片·改' },
            { code: Permission.DeleteAsset, label: '图片·删' },
        ],
    },
    {
        key: 'shipping',
        label: '配送',
        items: [
            { code: Permission.ReadShippingMethod, label: '配送·读' },
            { code: Permission.CreateShippingMethod, label: '配送·增' },
            { code: Permission.UpdateShippingMethod, label: '配送·改' },
            { code: Permission.DeleteShippingMethod, label: '配送·删' },
        ],
    },
    {
        key: 'payment',
        label: '支付',
        items: [
            { code: Permission.ReadPaymentMethod, label: '支付·读' },
            { code: Permission.CreatePaymentMethod, label: '支付·增' },
            { code: Permission.UpdatePaymentMethod, label: '支付·改' },
            { code: Permission.DeletePaymentMethod, label: '支付·删' },
        ],
    },
    {
        key: 'tenant',
        label: '租户管理',
        items: [
            { code: 'TenantRoleManage', label: '角色·管理' },
            { code: 'TenantMemberManage', label: '人员·管理' },
            { code: 'VerifyOrder', label: '核销·预留' },
        ],
    },
];

/** 租户级角色可用的业务权限白名单（由 PERMISSION_CATALOG 扁平派生，建模/校验统一使用） */
export const BUSINESS_PERMISSIONS: string[] = PERMISSION_CATALOG.flatMap((g) =>
    g.items.map((i) => i.code),
);

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
export function randomStrongPassword(length = 12): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%^&*_-+';
    const all = upper + lower + digits + symbols;
    const rand = (n: number) => Math.floor(Math.random() * n);
    const parts = [
        upper[rand(upper.length)],
        lower[rand(lower.length)],
        digits[rand(digits.length)],
        symbols[rand(symbols.length)],
    ];
    for (let i = parts.length; i < length; i++) parts.push(all[rand(all.length)]);
    for (let i = parts.length - 1; i > 0; i--) {
        const j = rand(i + 1);
        [parts[i], parts[j]] = [parts[j], parts[i]];
    }
    return parts.join('');
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

    /** 新建租户：自动分配 tenantNo（当前最大+1），code 由 tenantNo 派生 `t{tenantNo}`，避免手输冲突 */
    async createChannel(
        ctx: RequestContext,
        input: { name: string; token?: string; isOfficial?: boolean },
    ): Promise<any> {
        const tenantNo = await this.nextTenantNo(ctx);
        const code = `t${tenantNo}`;
        const channel = await this.channelService.create(ctx, {
            code,
            token: input.token,
            defaultLanguageCode: 'zh_Hans' as any,
            currencyCode: 'CNY' as any,
            pricesIncludeTax: true,
            customFields: {
                tenantNo,
                isOfficial: input.isOfficial ?? false,
                enabled: true,
                shopName: input.name,
            },
        } as any);
        // 自动创建 3 个默认角色（租户管理员/销售/库存），保证人员可即时绑定角色
        const channelId = String((channel as any).id);
        try {
            await Promise.all(
                OFFICIAL_ROLE_TEMPLATES.map((tpl) =>
                    this.createTenantRole(ctx, channelId, {
                        code: `t${tenantNo}-${tpl.busiPrefix}`,
                        description: tpl.description,
                        permissions: tpl.permissions,
                    }),
                ),
            );
        } catch (e: any) {
            Logger.warn(`租户 ${code} 默认角色创建失败（可手动补建）: ${e.message}`, loggerCtx);
        }
        Logger.info(`已创建租户 ${code}（tenantNo=${tenantNo}）`, loggerCtx);
        return channel;
    }

    /** 取当前最大 tenantNo，自增 1；无数据时从 0 开始（第 1 个租户得到 1）。
     *  用 TypeORM 原生 read 绕开 channelService.findAll 的 take≤1000 限制（否则新建租户必报「查询结果大于1000」）。 */
    private async nextTenantNo(ctx: RequestContext): Promise<number> {
        const repo = this.connection.getRepository(ctx, Channel);
        const channels = await repo.find();
        const nos = (channels as any[])
            .map((c: any) => Number(c?.customFields?.tenantNo))
            .filter((n: number) => Number.isFinite(n));
        return (nos.length ? Math.max(...nos) : 0) + 1;
    }

    /** 租户启停（仅超管） */
    async setChannelEnabled(ctx: RequestContext, channelId: ID, enabled: boolean): Promise<void> {
        await this.channelService.update(ctx, {
            id: channelId,
            customFields: { enabled },
        } as any);
    }

    /** 更新租户基础信息（仅超管）：name → shopName 一并写入 */
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
                shopName: input.name,
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

    /** 判断指定 channel 是否已存在该 code 的关联角色（幂等判定）。 */
    private async roleExistsInChannel(ctx: RequestContext, channelId: string, code: string): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, Role);
        const rows = await repo
            .createQueryBuilder('role')
            .leftJoinAndSelect('role.channels', 'ch')
            .where('role.code = :code', { code })
            .getMany();
        return (rows as any[]).some((r) => (r.channels || []).some((c: any) => String(c.id) === channelId));
    }

    /** 系统直建租户级角色（绕过 roleService.create 的权限校验，仅用于启动补种子/一键导入这类系统操作）。
     *  幂等：仅当该 code 在本 channel 不存在时才创建。 */
    private async createTenantRoleDirect(
        ctx: RequestContext,
        channelId: ID,
        input: { code: string; description: string; permissions: string[] },
    ): Promise<any> {
        this.assertBusinessPermissions(input.permissions);
        const chId = String(channelId);
        if (await this.roleExistsInChannel(ctx, chId, input.code)) return null;
        const channel = await this.connection
            .getRepository(ctx, Channel)
            .findOne({ where: { id: chId } } as any);
        if (!channel) throw new Error('CHANNEL_NOT_FOUND');
        const roleRepo = this.connection.getRepository(ctx, Role);
        const role = new Role({
            code: input.code,
            description: input.description,
            permissions: [`Authenticated`, ...input.permissions] as any,
        });
        role.channels = [channel];
        await roleRepo.save(role);
        return role;
    }

    /** 单租户一键导入默认三角色（幂等）。已初始化则返回空数组，不重复建。 */
    async importDefaultRoles(ctx: RequestContext, channelId: ID): Promise<any[]> {
        const channel = await this.connection
            .getRepository(ctx, Channel)
            .findOne({ where: { id: String(channelId) } } as any);
        if (!channel) throw new Error('CHANNEL_NOT_FOUND');
        const tenantNo = Number((channel as any).customFields?.tenantNo);
        if (!Number.isFinite(tenantNo)) throw new Error('TENANT_NO_MISSING');
        const chId = String(channelId);
        const adminCode = `t${tenantNo}-tenant-admin`;
        if (await this.roleExistsInChannel(ctx, chId, adminCode)) return [];
        const created: any[] = [];
        for (const tpl of OFFICIAL_ROLE_TEMPLATES) {
            const role = await this.createTenantRoleDirect(ctx, channelId, {
                code: `t${tenantNo}-${tpl.busiPrefix}`,
                description: tpl.description,
                permissions: tpl.permissions,
            });
            if (role) created.push(role);
        }
        return created;
    }

    /** 启动补种子：扫描所有 Channel，缺默认角色则幂等补建；异常仅打日志不阻塞启动。 */
    async ensureDefaultRolesForAllChannels(ctx: RequestContext): Promise<void> {
        const channelRepo = this.connection.getRepository(ctx, Channel);
        const channels = await channelRepo.find();
        let added = 0;
        for (const c of channels as any[]) {
            const tenantNo = Number(c?.customFields?.tenantNo);
            if (!Number.isFinite(tenantNo)) continue;
            try {
                added += (await this.importDefaultRoles(ctx, String(c.id))).length;
            } catch (e: any) {
                Logger.warn(`租户 ${String(c.id)} 默认角色补种失败: ${e.message}`, loggerCtx);
            }
        }
        Logger.info(`默认角色补种完成，共补建 ${added} 个角色`, loggerCtx);
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

    /** 更换某人员在该租户内的角色：归属 + 白名单 + 横向越权三重校验 */
    async updateTenantMemberRoles(
        ctx: RequestContext,
        channelId: ID,
        memberId: ID,
        roleIds: ID[],
    ): Promise<void> {
        await this.assertChannelMember(ctx);
        if (roleIds && roleIds.length > 0) {
            await this.assertRolesInChannel(ctx, roleIds, channelId);
        }
        const repo = this.connection.getRepository(ctx, TenantMember);
        const member = await repo.findOne({ where: { id: String(memberId) } });
        if (!member) throw new Error('MEMBER_NOT_FOUND');
        const memberChannelId = String(member.channelId);
        const targetChannelId = String(channelId);
        if (memberChannelId !== targetChannelId) throw new Error('MEMBER_NOT_IN_CHANNEL');
        await this.syncMemberRolesInChannel(ctx, member.administratorId as any, channelId, roleIds || []);
    }

    /** 以「合并」语义同步某管理员在本 channel 的角色：仅替换本租户角色，保留其在其它租户的角色（跨店任职互不影响） */
    async syncMemberRolesInChannel(
        ctx: RequestContext,
        administratorId: ID,
        channelId: ID,
        roleIds: ID[],
    ): Promise<void> {
        if (roleIds && roleIds.length > 0) {
            await this.assertRolesInChannel(ctx, roleIds, channelId);
        }
        const adminRepo = this.connection.getRepository(ctx, Administrator);
        const admin = await adminRepo.findOne({
            where: { id: String(administratorId) },
            relations: ['user', 'user.roles'],
        });
        if (!admin) throw new Error('ADMIN_NOT_FOUND');
        const chId = String(channelId);
        const own = ((admin.user?.roles as any[] | undefined) ?? []);
        const keep = own
            .filter((r: any) => !(r.channels || []).some((c: any) => String(c.id) === chId))
            .map((r: any) => String(r.id));
        const merged = Array.from(new Set([...keep, ...(roleIds || []).map(String)]));
        await this.administratorService.update(ctx, {
            id: String(administratorId),
            roleIds: merged,
        } as any);
    }

    /** 返回人员在当前租户内的角色 id（用于改角色弹层回显勾选） */
    async memberRoleIdsInChannel(ctx: RequestContext, member: TenantMember): Promise<ID[]> {
        if (!member?.administratorId) return [];
        const repo = this.connection.getRepository(ctx, Administrator);
        const admin = await repo.findOne({
            where: { id: member.administratorId },
            relations: ['user', 'user.roles'],
        });
        if (!admin?.user?.roles) return [];
        const channelId = String(member.channelId);
        return (admin.user.roles as any[])
            .filter((r: any) => (r.channels || []).some((c: any) => String(c.id) === channelId))
            .map((r: any) => String(r.id));
    }

    /** 将 TenantMember 组装为含 roleIds 的视图对象（供列表查询直接返回，避免依赖 @ResolveField 子解析造成非空字段 null 报错） */
    async memberToView(ctx: RequestContext, member: TenantMember): Promise<any> {
        return {
            ...member,
            roleIds: await this.memberRoleIdsInChannel(ctx, member),
        };
    }

    /** 超管为租户建管理员账号并绑定角色，同时写入 TenantMember */
    async createTenantAdministrator(ctx: RequestContext, channelId: ID, input: CreateTenantAdminInput): Promise<TenantMember> {
        if (input.roleIds && input.roleIds.length > 0) {
            await this.assertRolesInChannel(ctx, input.roleIds, channelId);
        }
        // 未显式提供密码 → 生成随机强口令，并默认标记首登强改密
        const generated = !input.password;
        const password = input.password ?? randomStrongPassword();
        const mustChangePassword = input.forcePasswordChange === true || generated;
        const admin = await this.administratorService.create(ctx, {
            firstName: input.firstName ?? '',
            lastName: input.lastName ?? input.emailAddress,
            emailAddress: input.emailAddress,
            password,
            roleIds: input.roleIds,
        } as any);
        const repo = this.connection.getRepository(ctx, TenantMember);
        const member = new TenantMember();
        member.administratorId = String(admin.id);
        member.channelId = String(channelId);
        member.enabled = input.enabled ?? true;
        member.mustChangePassword = mustChangePassword;
        member.displayName = input.displayName ?? input.emailAddress;
        member.remark = input.remark ?? null;
        member.phone = input.phone ?? null;
        await repo.save(member);
        if (generated) {
            // 一次性初始口令：仅本属性运行时回传展示，不落库
            (member as any).initialPassword = password;
        }
        return member;
    }

    /** 当前登录者修改自身密码：更新 Administrator 密码，并清除其所有租户关联的首登强改密标志 */
    async changeMyPassword(ctx: RequestContext, newPassword: string): Promise<void> {
        if (!newPassword || newPassword.length < 8) throw new Error('WEAK_PASSWORD');
        const user = (ctx as any).session?.user;
        if (!user?.id) throw new Error('NOT_AUTHENTICATED');
        const adminId = String(user.id);
        await this.administratorService.update(ctx, { id: adminId as any, password: newPassword } as any);
        const repo = this.connection.getRepository(ctx, TenantMember);
        const members = await repo.find({ where: { administratorId: adminId } });
        for (const m of members) {
            if (m.mustChangePassword) {
                m.mustChangePassword = false;
                await repo.save(m);
            }
        }
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

    /** 搜索后台账号（按邮箱/姓氏模糊匹配），返回各账号在租户内的关联统计，供「关联已有账号进租户」选择 */
    async searchAdmins(ctx: RequestContext, channelId: ID, keyword?: string, take = 10): Promise<any[]> {
        const adminRepo = this.connection.getRepository(ctx, Administrator);
        const admins = await adminRepo.find({ take: 500 });
        const kw = (keyword || '').toString().toLowerCase().trim();
        const memberRepo = this.connection.getRepository(ctx, TenantMember);
        const members = await memberRepo.find();
        const chId = channelId != null ? String(channelId) : null;
        return admins
            .filter((a: any) => {
                if (!kw) return true;
                const email = String(a.emailAddress || '').toLowerCase();
                const lastName = String(a.lastName || '').toLowerCase();
                return email.includes(kw) || lastName.includes(kw);
            })
            .slice(0, take)
            .map((a: any) => {
                const linked = members.filter((m) => String(m.administratorId) === String(a.id));
                return {
                    id: String(a.id),
                    emailAddress: a.emailAddress,
                    displayName: a.lastName ?? a.emailAddress,
                    linkedCount: linked.length,
                    linkedChannelIds: linked.map((m) => String(m.channelId)),
                    alreadyLinked: chId != null ? linked.some((m) => String(m.channelId) === chId) : false,
                };
            });
    }

    /** 将既有后台账号关联进某租户（写入 TenantMember 并合并绑定本租户角色）；若已在该租户则报错 */
    async linkMember(
        ctx: RequestContext,
        channelId: ID,
        input: {
            administratorId: ID;
            roleIds?: ID[];
            enabled?: boolean;
            displayName?: string;
            phone?: string;
            remark?: string;
        },
    ): Promise<any> {
        const adminRepo = this.connection.getRepository(ctx, Administrator);
        const admin = await adminRepo.findOne({ where: { id: String(input.administratorId) } });
        if (!admin) throw new Error('ADMIN_NOT_FOUND');
        const repo = this.connection.getRepository(ctx, TenantMember);
        const chId = String(channelId);
        const existing = await repo.findOne({
            where: { administratorId: String(input.administratorId), channelId: chId },
        });
        if (existing) throw new Error('ALREADY_IN_CHANNEL');
        const member = new TenantMember();
        member.administratorId = String(input.administratorId);
        member.channelId = chId;
        member.enabled = input.enabled ?? true;
        member.mustChangePassword = false;
        member.displayName = input.displayName ?? (admin as any)?.lastName ?? (admin as any)?.emailAddress;
        member.phone = input.phone ?? null;
        member.remark = input.remark ?? null;
        await repo.save(member);
        await this.syncMemberRolesInChannel(ctx, member.administratorId, chId, input.roleIds || []);
        return this.memberToView(ctx, member);
    }

    /** 租户管理员更新「本 channel」装修类 customFields（仅覆盖传入字段，禁止触碰安全字段） */
    async updateMyChannelCustomFields(ctx: RequestContext, input: Record<string, any> = {}): Promise<any> {
        const channelId = String(ctx.channelId);
        const channelRepo = this.connection.getRepository(ctx, Channel);
        const channel = await channelRepo.findOne({ where: { id: channelId } as any });
        if (!channel) throw new Error('CHANNEL_NOT_FOUND');
        // 安全字段禁止租户端越权修改（启停/租户号/官营标记仅超管可改）
        const protectedKeys = ['enabled', 'tenantNo', 'isOfficial'];
        const merged = {
            ...((channel as any).customFields || {}),
            ...Object.fromEntries(Object.entries(input).filter(([k]) => !protectedKeys.includes(k))),
        };
        await this.channelService.update(ctx, { id: channelId, customFields: merged } as any);
        return this.channelService.findOne(ctx, channelId as any);
    }
}
