"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantMemberService = exports.GLOBAL_ROLE_PREFIX = exports.BUSINESS_PERMISSIONS = exports.PERMISSION_CATALOG = void 0;
exports.normalizeGlobalRoleCode = normalizeGlobalRoleCode;
exports.randomStrongPassword = randomStrongPassword;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
const tenant_member_entity_1 = require("./tenant-member.entity");
const role_templates_1 = require("./role-templates");
/**
 * 租户级业务权限目录（单一来源，前后端共用，避免双份硬编码）。
 * 不含超管专属权限；Vendure v3 已将 Variant/Fulfillment 等合并进 catalog/product/order 权限。
 * 前端角色管理页通过 permissionCatalog 查询动态渲染，BUSINESS_PERMISSIONS 由此扁平派生。
 */
exports.PERMISSION_CATALOG = [
    {
        key: 'catalog',
        label: '商品/目录',
        items: [
            { code: core_1.Permission.ReadCatalog, label: '目录·读' },
            { code: core_1.Permission.CreateCatalog, label: '目录·增' },
            { code: core_1.Permission.UpdateCatalog, label: '目录·改' },
            { code: core_1.Permission.DeleteCatalog, label: '目录·删' },
            { code: core_1.Permission.ReadProduct, label: '商品·读' },
            { code: core_1.Permission.CreateProduct, label: '商品·增' },
            { code: core_1.Permission.UpdateProduct, label: '商品·改' },
            { code: core_1.Permission.DeleteProduct, label: '商品·删' },
        ],
    },
    {
        key: 'collection',
        label: '分类',
        items: [
            { code: core_1.Permission.ReadCollection, label: '分类·读' },
            { code: core_1.Permission.CreateCollection, label: '分类·增' },
            { code: core_1.Permission.UpdateCollection, label: '分类·改' },
            { code: core_1.Permission.DeleteCollection, label: '分类·删' },
        ],
    },
    {
        key: 'order',
        label: '订单',
        items: [
            { code: core_1.Permission.ReadOrder, label: '订单·读' },
            { code: core_1.Permission.UpdateOrder, label: '订单·改' },
            { code: core_1.Permission.CreateOrder, label: '订单·建' },
        ],
    },
    {
        key: 'asset',
        label: '图片',
        items: [
            { code: core_1.Permission.ReadAsset, label: '图片·读' },
            { code: core_1.Permission.CreateAsset, label: '图片·传' },
            { code: core_1.Permission.UpdateAsset, label: '图片·改' },
            { code: core_1.Permission.DeleteAsset, label: '图片·删' },
        ],
    },
    {
        key: 'shipping',
        label: '配送',
        items: [
            { code: core_1.Permission.ReadShippingMethod, label: '配送·读' },
            { code: core_1.Permission.CreateShippingMethod, label: '配送·增' },
            { code: core_1.Permission.UpdateShippingMethod, label: '配送·改' },
            { code: core_1.Permission.DeleteShippingMethod, label: '配送·删' },
        ],
    },
    {
        key: 'payment',
        label: '支付',
        items: [
            { code: core_1.Permission.ReadPaymentMethod, label: '支付·读' },
            { code: core_1.Permission.CreatePaymentMethod, label: '支付·增' },
            { code: core_1.Permission.UpdatePaymentMethod, label: '支付·改' },
            { code: core_1.Permission.DeletePaymentMethod, label: '支付·删' },
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
exports.BUSINESS_PERMISSIONS = exports.PERMISSION_CATALOG.flatMap((g) => g.items.map((i) => i.code));
/** 全局角色 code 前缀：超管建的全局角色统一加此前缀，用于池查询与全局/本地判定（Vendure Role 无 customFields，用前缀区分） */
exports.GLOBAL_ROLE_PREFIX = 'g-';
/** 全局角色 code 规范化：输入 code 自动统一为 `g-{code}`，避免手动误输入前缀产生重复 */
function normalizeGlobalRoleCode(code) {
    const c = code.trim();
    return c.startsWith(exports.GLOBAL_ROLE_PREFIX) ? c : exports.GLOBAL_ROLE_PREFIX + c;
}
/** 生成随机强口令：≥10 位，保证大小写/数字/符号各类至少一个 */
function randomStrongPassword(length = 12) {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%^&*_-+';
    const all = upper + lower + digits + symbols;
    const rand = (n) => Math.floor(Math.random() * n);
    const parts = [
        upper[rand(upper.length)],
        lower[rand(lower.length)],
        digits[rand(digits.length)],
        symbols[rand(symbols.length)],
    ];
    for (let i = parts.length; i < length; i++)
        parts.push(all[rand(all.length)]);
    for (let i = parts.length - 1; i > 0; i--) {
        const j = rand(i + 1);
        [parts[i], parts[j]] = [parts[j], parts[i]];
    }
    return parts.join('');
}
let TenantMemberService = class TenantMemberService {
    constructor(connection, administratorService, roleService, channelService) {
        this.connection = connection;
        this.administratorService = administratorService;
        this.roleService = roleService;
        this.channelService = channelService;
    }
    /** 校验角色权限全部在业务权限白名单内（超管专属权限不入租户角色） */
    assertBusinessPermissions(permissions) {
        const invalid = permissions.filter((p) => !exports.BUSINESS_PERMISSIONS.includes(p));
        if (invalid.length > 0) {
            throw new Error(`FORBIDDEN_PERMISSION: ${invalid.join(',')} 为超管专属权限`);
        }
    }
    /** 校验请求方是该 channel 的租户管理员（或超管） */
    assertChannelMember(ctx, channelId) {
        var _a, _b;
        if (ctx.userHasPermissions([core_1.Permission.SuperAdmin]))
            return;
        const target = channelId != null ? String(channelId) : String(ctx.channelId);
        const perms = ((_b = (_a = ctx.session) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.channelPermissions) || [];
        const ok = perms.some((c) => String(c.id) === target);
        if (!ok)
            throw new Error('CHANNEL_FORBIDDEN');
    }
    /** 安全加固：校验目标角色必须属于指定 channel，防止跨租户改/删任意角色（横向越权） */
    async assertRoleInChannel(ctx, roleId, channelId) {
        const roleRepo = this.connection.getRepository(ctx, core_1.Role);
        const role = await roleRepo.findOne({ where: { id: roleId }, relations: ['channels'] });
        if (!role)
            throw new Error('ROLE_NOT_FOUND');
        const belongs = (role.channels || []).some((c) => String(c.id) === String(channelId));
        if (!belongs)
            throw new Error('CHANNEL_FORBIDDEN');
    }
    /** 安全加固：校验待绑定角色全部属于指定 channel，防止租户管理员绑定别店角色提权 */
    async assertRolesInChannel(ctx, roleIds, channelId) {
        for (const roleId of roleIds) {
            await this.assertRoleInChannel(ctx, roleId, channelId);
        }
    }
    /** 新建租户：自动分配 tenantNo（当前最大+1），code 由 tenantNo 派生 `t{tenantNo}`，避免手输冲突 */
    async createChannel(ctx, input) {
        var _a;
        const tenantNo = await this.nextTenantNo(ctx);
        const code = `t${tenantNo}`;
        const channel = await this.channelService.create(ctx, {
            code,
            token: input.token,
            defaultLanguageCode: 'zh_Hans',
            currencyCode: 'CNY',
            pricesIncludeTax: true,
            customFields: {
                tenantNo,
                isOfficial: (_a = input.isOfficial) !== null && _a !== void 0 ? _a : false,
                enabled: true,
                shopName: input.name,
            },
        });
        // 自动创建 3 个默认角色（租户管理员/销售/库存），保证人员可即时绑定角色
        const channelId = String(channel.id);
        try {
            await Promise.all(role_templates_1.OFFICIAL_ROLE_TEMPLATES.map((tpl) => this.createTenantRole(ctx, channelId, {
                code: `t${tenantNo}-${tpl.busiPrefix}`,
                description: tpl.description,
                permissions: tpl.permissions,
            })));
        }
        catch (e) {
            core_1.Logger.warn(`租户 ${code} 默认角色创建失败（可手动补建）: ${e.message}`, constants_1.loggerCtx);
        }
        core_1.Logger.info(`已创建租户 ${code}（tenantNo=${tenantNo}）`, constants_1.loggerCtx);
        return channel;
    }
    /** 取当前最大 tenantNo，自增 1；无数据时从 0 开始（第 1 个租户得到 1）。
     *  用 TypeORM 原生 read 绕开 channelService.findAll 的 take≤1000 限制（否则新建租户必报「查询结果大于1000」）。 */
    async nextTenantNo(ctx) {
        const repo = this.connection.getRepository(ctx, core_1.Channel);
        const channels = await repo.find();
        const nos = channels
            .map((c) => { var _a; return Number((_a = c === null || c === void 0 ? void 0 : c.customFields) === null || _a === void 0 ? void 0 : _a.tenantNo); })
            .filter((n) => Number.isFinite(n));
        return (nos.length ? Math.max(...nos) : 0) + 1;
    }
    /** 租户启停（仅超管） */
    async setChannelEnabled(ctx, channelId, enabled) {
        await this.channelService.update(ctx, {
            id: channelId,
            customFields: { enabled },
        });
    }
    /** 更新租户基础信息（仅超管）：name → shopName 一并写入 */
    async updateChannel(ctx, channelId, input) {
        await this.channelService.update(ctx, {
            id: channelId,
            customFields: {
                tenantNo: input.tenantNo,
                isOfficial: input.isOfficial,
                shopName: input.name,
            },
        });
    }
    /** 租户级角色创建（限定 channelIds=[channelId]；权限白名单校验） */
    async createTenantRole(ctx, channelId, input) {
        this.assertBusinessPermissions(input.permissions);
        return this.roleService.create(ctx, {
            code: input.code,
            description: input.description,
            permissions: input.permissions,
            channelIds: [channelId],
        });
    }
    /** 判断指定 channel 是否已存在该 code 的关联角色（幂等判定）。 */
    async roleExistsInChannel(ctx, channelId, code) {
        const repo = this.connection.getRepository(ctx, core_1.Role);
        const rows = await repo
            .createQueryBuilder('role')
            .leftJoinAndSelect('role.channels', 'ch')
            .where('role.code = :code', { code })
            .getMany();
        return rows.some((r) => (r.channels || []).some((c) => String(c.id) === channelId));
    }
    /** 按 channelId 直查该租户全部角色（绕过 roleService.findAll 的「当前用户在目标 channel 需拥有全部权限」过滤，
     *  否则超管在未绑定的 channerl 上会读不到该租户任何角色）。 */
    async rolesForChannel(ctx, channelId) {
        const repo = this.connection.getRepository(ctx, core_1.Role);
        const all = await repo.find({ relations: ['channels'] });
        const chId = String(channelId);
        return all.filter((r) => (r.channels || []).some((c) => String(c.id) === chId));
    }
    /** 系统直建租户级角色（绕过 roleService.create 的权限校验，仅用于启动补种子/一键导入这类系统操作）。
     *  幂等：仅当该 code 在本 channel 不存在时才创建。 */
    async createTenantRoleDirect(ctx, channelId, input) {
        this.assertBusinessPermissions(input.permissions);
        const chId = String(channelId);
        if (await this.roleExistsInChannel(ctx, chId, input.code))
            return null;
        const channel = await this.connection
            .getRepository(ctx, core_1.Channel)
            .findOne({ where: { id: chId } });
        if (!channel)
            throw new Error('CHANNEL_NOT_FOUND');
        const roleRepo = this.connection.getRepository(ctx, core_1.Role);
        const role = new core_1.Role({
            code: input.code,
            description: input.description,
            permissions: [`Authenticated`, ...input.permissions],
        });
        role.channels = [channel];
        await roleRepo.save(role);
        return role;
    }
    /** 建全局角色并批量分发到店：code 自动加 `g-` 前缀；channelIds 为空 → channels=[]（全局可用），非空 → channels=[勾选店]（全局默认）。
     *  统一幂等：code 已存在则仅追加缺失店，绝不重复关联同一店。所有加店路径（创建时勾选/分发/引用）均应收敛到此核心语义。 */
    async createGlobalRoleWithChannels(ctx, channelIds, input) {
        this.assertBusinessPermissions(input.permissions);
        const code = normalizeGlobalRoleCode(input.code);
        const targetChannels = [];
        for (const id of channelIds || []) {
            const ch = await this.connection
                .getRepository(ctx, core_1.Channel)
                .findOne({ where: { id: String(id) } });
            if (ch)
                targetChannels.push(ch);
        }
        const roleRepo = this.connection.getRepository(ctx, core_1.Role);
        const existing = await roleRepo.findOne({
            where: { code },
            relations: ['channels'],
        });
        if (existing) {
            // 已存在：仅追加缺少的分发店（幂等）
            const curIds = (existing.channels || []).map((c) => String(c.id));
            existing.channels = [...(existing.channels || [])];
            for (const ch of targetChannels) {
                if (!curIds.includes(String(ch.id)))
                    existing.channels.push(ch);
            }
            await roleRepo.save(existing);
            return [existing];
        }
        const role = new core_1.Role({
            code,
            description: input.description,
            permissions: [`Authenticated`, ...input.permissions],
        });
        role.channels = targetChannels;
        await roleRepo.save(role);
        return [role];
    }
    /** 直建全局可用角色（channels=[]）。空 channelIds 走 createGlobalRoleWithChannels；保持幂等语义。 */
    async createGlobalRoleDirect(ctx, input) {
        const [role] = await this.createGlobalRoleWithChannels(ctx, [], input);
        return role;
    }
    /** 把全局角色引用到某店（幂等：已含该店则 no-op；仅 g- 前缀全局角色允许被引用，租户本地角色不可引）。
     *  超管从池继续分发也已含本方法，故去掉原「channels 必须为空」限制，允许多店分发。 */
    async referGlobalRoleToChannel(ctx, roleId, channelId) {
        const roleRepo = this.connection.getRepository(ctx, core_1.Role);
        const role = await roleRepo.findOne({
            where: { id: String(roleId) },
            relations: ['channels'],
        });
        if (!role)
            throw new Error('ROLE_NOT_FOUND');
        if (!String(role.code).startsWith(exports.GLOBAL_ROLE_PREFIX))
            throw new Error('NOT_GLOBAL_ROLE');
        const chId = String(channelId);
        const curIds = (role.channels || []).map((c) => String(c.id));
        if (!curIds.includes(chId)) {
            const ch = await this.connection
                .getRepository(ctx, core_1.Channel)
                .findOne({ where: { id: chId } });
            if (!ch)
                throw new Error('CHANNEL_NOT_FOUND');
            role.channels = [...(role.channels || []), ch];
            await roleRepo.save(role);
        }
    }
    /** 取消某店对该全局角色的引用（移除该店；channels 变空则回到全局池）。 */
    async unreferGlobalRoleFromChannel(ctx, roleId, channelId) {
        const roleRepo = this.connection.getRepository(ctx, core_1.Role);
        const role = await roleRepo.findOne({
            where: { id: String(roleId) },
            relations: ['channels'],
        });
        if (!role)
            throw new Error('ROLE_NOT_FOUND');
        const chId = String(channelId);
        role.channels = (role.channels || []).filter((c) => String(c.id) !== chId);
        await roleRepo.save(role);
    }
    /** 租户自助：引用全局角色到当前 ctx.channelId。仅允许引用「未绑定任何店」的 g- 角色（channels=[]），
     *  防止租户引用已被他店绑定（channels 非空）的角色造成跨店共享越权。 */
    async myReferGlobalRole(ctx, roleId) {
        const roleRepo = this.connection.getRepository(ctx, core_1.Role);
        const role = await roleRepo.findOne({
            where: { id: String(roleId) },
            relations: ['channels'],
        });
        if (!role)
            throw new Error('ROLE_NOT_FOUND');
        if (!String(role.code).startsWith(exports.GLOBAL_ROLE_PREFIX))
            throw new Error('NOT_GLOBAL_ROLE');
        if ((role.channels || []).length > 0)
            throw new Error('ROLE_ALREADY_REFERENCED');
        await this.referGlobalRoleToChannel(ctx, roleId, ctx.channelId);
    }
    /** 租户自助可引用列表：仅返回「未绑定任何店」的 g- 角色（channels=[]，可引用）。 */
    async globalRolesAvailable(ctx) {
        const repo = this.connection.getRepository(ctx, core_1.Role);
        const all = await repo.find({ relations: ['channels'] });
        return all.filter((r) => String(r.code).startsWith(exports.GLOBAL_ROLE_PREFIX) && !(r.channels || []).length);
    }
    /** 租户自助：从当前 ctx.channelId 取消引用。 */
    async myUnreferGlobalRole(ctx, roleId) {
        await this.unreferGlobalRoleFromChannel(ctx, roleId, ctx.channelId);
    }
    /** 查全部全局角色（code 以 g- 开头；channels 可为空=全局可用，非空=已分发到店）。 */
    async globalRoles(ctx) {
        const repo = this.connection.getRepository(ctx, core_1.Role);
        const all = await repo.find({ relations: ['channels'] });
        return all.filter((r) => String(r.code).startsWith(exports.GLOBAL_ROLE_PREFIX));
    }
    /** 全局默认角色模板（不落库为 Role）：租户"导入到本店"时复制独立副本，各租户权限互不影响 */
    async globalRoleTemplates(ctx) {
        return role_templates_1.OFFICIAL_ROLE_TEMPLATES.map((tpl) => ({
            key: tpl.key,
            busiPrefix: tpl.busiPrefix,
            description: tpl.description,
            permissions: tpl.permissions,
        }));
    }
    /** 单租户一键导入默认三角色（幂等）。已初始化则返回空数组，不重复建。 */
    async importDefaultRoles(ctx, channelId) {
        var _a;
        const channel = await this.connection
            .getRepository(ctx, core_1.Channel)
            .findOne({ where: { id: String(channelId) } });
        if (!channel)
            throw new Error('CHANNEL_NOT_FOUND');
        const tenantNo = Number((_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.tenantNo);
        if (!Number.isFinite(tenantNo))
            throw new Error('TENANT_NO_MISSING');
        const chId = String(channelId);
        const adminCode = `t${tenantNo}-tenant-admin`;
        if (await this.roleExistsInChannel(ctx, chId, adminCode))
            return [];
        const created = [];
        for (const tpl of role_templates_1.OFFICIAL_ROLE_TEMPLATES) {
            const role = await this.createTenantRoleDirect(ctx, channelId, {
                code: `t${tenantNo}-${tpl.busiPrefix}`,
                description: tpl.description,
                permissions: tpl.permissions,
            });
            if (role)
                created.push(role);
        }
        return created;
    }
    /** 租户自助：从全局默认模板复制独立副本到当前 ctx.channelId（幂等，复用 importDefaultRoles） */
    async myImportDefaultRoles(ctx) {
        return this.importDefaultRoles(ctx, ctx.channelId);
    }
    /** 启动补种子：扫描所有 Channel，缺默认角色则幂等补建；异常仅打日志不阻塞启动。 */
    async ensureDefaultRolesForAllChannels(ctx) {
        var _a;
        const channelRepo = this.connection.getRepository(ctx, core_1.Channel);
        const channels = await channelRepo.find();
        let added = 0;
        for (const c of channels) {
            const tenantNo = Number((_a = c === null || c === void 0 ? void 0 : c.customFields) === null || _a === void 0 ? void 0 : _a.tenantNo);
            if (!Number.isFinite(tenantNo))
                continue;
            try {
                added += (await this.importDefaultRoles(ctx, String(c.id))).length;
            }
            catch (e) {
                core_1.Logger.warn(`租户 ${String(c.id)} 默认角色补种失败: ${e.message}`, constants_1.loggerCtx);
            }
        }
        core_1.Logger.info(`默认角色补种完成，共补建 ${added} 个角色`, constants_1.loggerCtx);
    }
    /** 把指定渠道关联到超管角色（幂等）——超管全局豁免渠道校验的核心：superadmin 角色须覆盖所有渠道，
     *  否则超管切到未绑定角色渠道时 Vendure 权限守卫无任何权限，无法在租户内发商品/提审等操作。 */
    async ensureSuperAdminRoleCoversChannel(ctx, channelId) {
        await this.ensureSuperAdminRoleCoversChannels(ctx, [String(channelId)]);
    }
    /** 把所有存量渠道补关联到超管角色（幂等；失败仅打日志不阻塞启动） */
    async ensureSuperAdminRoleCoversAllChannels(ctx) {
        const channelRepo = this.connection.getRepository(ctx, core_1.Channel);
        const channels = await channelRepo.find();
        await this.ensureSuperAdminRoleCoversChannels(ctx, channels.map((c) => String(c.id)));
    }
    /** 把指定渠道列表关联到超管角色（幂等：已含则 no-op）。superadmin 角色自带 SuperAdmin 权限，
     *  一旦覆盖某渠道，userHasPermissions(Permission.SuperAdmin) 在该渠道即返回 true，实现超管全局豁免。 */
    async ensureSuperAdminRoleCoversChannels(ctx, channelIds) {
        const roleRepo = this.connection.getRepository(ctx, core_1.Role);
        const superAdminRole = await roleRepo
            .createQueryBuilder('role')
            .leftJoinAndSelect('role.channels', 'ch')
            .where('role.code = :code', { code: '__super_admin_role__' })
            .getOne();
        if (!superAdminRole) {
            core_1.Logger.warn('超管角色 __super_admin_role__ 不存在，跳过渠道覆盖', constants_1.loggerCtx);
            return;
        }
        let changed = false;
        const curIds = (superAdminRole.channels || []).map((c) => String(c.id));
        for (const chId of channelIds) {
            if (curIds.includes(String(chId)))
                continue;
            const ch = await this.connection.getRepository(ctx, core_1.Channel).findOne({ where: { id: String(chId) } });
            if (ch) {
                superAdminRole.channels = [...(superAdminRole.channels || []), ch];
                changed = true;
            }
        }
        if (changed) {
            await roleRepo.save(superAdminRole);
            core_1.Logger.info(`超管角色渠道覆盖完成：新增渠道 ${channelIds.filter((id) => !curIds.includes(String(id))).join(', ')}`, constants_1.loggerCtx);
        }
    }
    /** 租户级角色更新（权限白名单校验；channelId 非空时校验角色归属，防横向越权） */
    async updateTenantRole(ctx, roleId, input, channelId) {
        if (channelId != null)
            await this.assertRoleInChannel(ctx, roleId, channelId);
        if (input.permissions)
            this.assertBusinessPermissions(input.permissions);
        return this.roleService.update(ctx, {
            id: roleId,
            code: input.code,
            description: input.description,
            permissions: input.permissions,
        });
    }
    /** 租户级角色删除（channelId 非空时校验角色归属，防横向越权） */
    async deleteTenantRole(ctx, roleId, channelId) {
        if (channelId != null)
            await this.assertRoleInChannel(ctx, roleId, channelId);
        await this.roleService.delete(ctx, roleId);
    }
    /** 更换某人员在该租户内的角色：归属 + 白名单 + 横向越权三重校验 */
    async updateTenantMemberRoles(ctx, channelId, memberId, roleIds) {
        await this.assertChannelMember(ctx);
        if (roleIds && roleIds.length > 0) {
            await this.assertRolesInChannel(ctx, roleIds, channelId);
        }
        const repo = this.connection.getRepository(ctx, tenant_member_entity_1.TenantMember);
        const member = await repo.findOne({ where: { id: String(memberId) } });
        if (!member)
            throw new Error('MEMBER_NOT_FOUND');
        const memberChannelId = String(member.channelId);
        const targetChannelId = String(channelId);
        if (memberChannelId !== targetChannelId)
            throw new Error('MEMBER_NOT_IN_CHANNEL');
        await this.syncMemberRolesInChannel(ctx, member.administratorId, channelId, roleIds || []);
    }
    /** 以「合并」语义同步某管理员在本 channel 的角色：仅替换本租户角色，保留其在其它租户的角色（跨店任职互不影响） */
    async syncMemberRolesInChannel(ctx, administratorId, channelId, roleIds) {
        var _a, _b;
        if (roleIds && roleIds.length > 0) {
            await this.assertRolesInChannel(ctx, roleIds, channelId);
        }
        const adminRepo = this.connection.getRepository(ctx, core_1.Administrator);
        const admin = await adminRepo.findOne({
            where: { id: String(administratorId) },
            relations: ['user', 'user.roles'],
        });
        if (!admin)
            throw new Error('ADMIN_NOT_FOUND');
        const chId = String(channelId);
        const own = ((_b = (_a = admin.user) === null || _a === void 0 ? void 0 : _a.roles) !== null && _b !== void 0 ? _b : []);
        const keep = own
            .filter((r) => !(r.channels || []).some((c) => String(c.id) === chId))
            .map((r) => String(r.id));
        const merged = Array.from(new Set([...keep, ...(roleIds || []).map(String)]));
        await this.administratorService.update(ctx, {
            id: String(administratorId),
            roleIds: merged,
        });
    }
    /** 返回人员在当前租户内的角色 id（用于改角色弹层回显勾选） */
    async memberRoleIdsInChannel(ctx, member) {
        var _a;
        if (!(member === null || member === void 0 ? void 0 : member.administratorId))
            return [];
        const repo = this.connection.getRepository(ctx, core_1.Administrator);
        const admin = await repo.findOne({
            where: { id: member.administratorId },
            relations: ['user', 'user.roles'],
        });
        if (!((_a = admin === null || admin === void 0 ? void 0 : admin.user) === null || _a === void 0 ? void 0 : _a.roles))
            return [];
        const channelId = String(member.channelId);
        return admin.user.roles
            .filter((r) => (r.channels || []).some((c) => String(c.id) === channelId))
            .map((r) => String(r.id));
    }
    /** 将 TenantMember 组装为含 roleIds 的视图对象（供列表查询直接返回，避免依赖 @ResolveField 子解析造成非空字段 null 报错） */
    async memberToView(ctx, member) {
        return Object.assign(Object.assign({}, member), { roleIds: await this.memberRoleIdsInChannel(ctx, member) });
    }
    /** 超管为租户建管理员账号并绑定角色，同时写入 TenantMember */
    async createTenantAdministrator(ctx, channelId, input) {
        var _a, _b, _c, _d, _e, _f, _g;
        if (input.roleIds && input.roleIds.length > 0) {
            await this.assertRolesInChannel(ctx, input.roleIds, channelId);
        }
        // 未显式提供密码 → 生成随机强口令，并默认标记首登强改密
        const generated = !input.password;
        const password = (_a = input.password) !== null && _a !== void 0 ? _a : randomStrongPassword();
        const mustChangePassword = input.forcePasswordChange === true || generated;
        const admin = await this.administratorService.create(ctx, {
            firstName: (_b = input.firstName) !== null && _b !== void 0 ? _b : '',
            lastName: (_c = input.lastName) !== null && _c !== void 0 ? _c : input.emailAddress,
            emailAddress: input.emailAddress,
            password,
            roleIds: input.roleIds,
        });
        const repo = this.connection.getRepository(ctx, tenant_member_entity_1.TenantMember);
        const member = new tenant_member_entity_1.TenantMember();
        member.administratorId = String(admin.id);
        member.channelId = String(channelId);
        member.enabled = (_d = input.enabled) !== null && _d !== void 0 ? _d : true;
        member.mustChangePassword = mustChangePassword;
        member.displayName = (_e = input.displayName) !== null && _e !== void 0 ? _e : input.emailAddress;
        member.remark = (_f = input.remark) !== null && _f !== void 0 ? _f : null;
        member.phone = (_g = input.phone) !== null && _g !== void 0 ? _g : null;
        await repo.save(member);
        if (generated) {
            // 一次性初始口令：仅本属性运行时回传展示，不落库
            member.initialPassword = password;
        }
        return member;
    }
    /** 当前登录者修改自身密码：更新 Administrator 密码，并清除其所有租户关联的首登强改密标志 */
    async changeMyPassword(ctx, newPassword) {
        var _a;
        if (!newPassword || newPassword.length < 8)
            throw new Error('WEAK_PASSWORD');
        const user = (_a = ctx.session) === null || _a === void 0 ? void 0 : _a.user;
        if (!(user === null || user === void 0 ? void 0 : user.id))
            throw new Error('NOT_AUTHENTICATED');
        const adminId = String(user.id);
        await this.administratorService.update(ctx, { id: adminId, password: newPassword });
        const repo = this.connection.getRepository(ctx, tenant_member_entity_1.TenantMember);
        const members = await repo.find({ where: { administratorId: adminId } });
        for (const m of members) {
            if (m.mustChangePassword) {
                m.mustChangePassword = false;
                await repo.save(m);
            }
        }
    }
    /** 租户人员启停 */
    async setMemberEnabled(ctx, channelId, memberId, enabled) {
        const repo = this.connection.getRepository(ctx, tenant_member_entity_1.TenantMember);
        const member = await repo.findOne({ where: { id: memberId, channelId: String(channelId) } });
        if (!member)
            throw new Error('MEMBER_NOT_FOUND');
        member.enabled = enabled;
        await repo.save(member);
    }
    /** 租户人员移除（仅删 TenantMember 关联，Administrator 本体保留） */
    async removeMember(ctx, channelId, memberId) {
        const repo = this.connection.getRepository(ctx, tenant_member_entity_1.TenantMember);
        const member = await repo.findOne({ where: { id: memberId, channelId: String(channelId) } });
        if (!member)
            throw new Error('MEMBER_NOT_FOUND');
        await repo.remove(member);
    }
    /** 搜索后台账号（按邮箱/姓氏模糊匹配），返回各账号在租户内的关联统计，供「关联已有账号进租户」选择 */
    async searchAdmins(ctx, channelId, keyword, take = 10) {
        const adminRepo = this.connection.getRepository(ctx, core_1.Administrator);
        const admins = await adminRepo.find({ take: 500 });
        const kw = (keyword || '').toString().toLowerCase().trim();
        const memberRepo = this.connection.getRepository(ctx, tenant_member_entity_1.TenantMember);
        const members = await memberRepo.find();
        const chId = channelId != null ? String(channelId) : null;
        return admins
            .filter((a) => {
            if (!kw)
                return true;
            const email = String(a.emailAddress || '').toLowerCase();
            const lastName = String(a.lastName || '').toLowerCase();
            return email.includes(kw) || lastName.includes(kw);
        })
            .slice(0, take)
            .map((a) => {
            var _a;
            const linked = members.filter((m) => String(m.administratorId) === String(a.id));
            return {
                id: String(a.id),
                emailAddress: a.emailAddress,
                displayName: (_a = a.lastName) !== null && _a !== void 0 ? _a : a.emailAddress,
                linkedCount: linked.length,
                linkedChannelIds: linked.map((m) => String(m.channelId)),
                alreadyLinked: chId != null ? linked.some((m) => String(m.channelId) === chId) : false,
            };
        });
    }
    /** 将既有后台账号关联进某租户（写入 TenantMember 并合并绑定本租户角色）；若已在该租户则报错 */
    async linkMember(ctx, channelId, input) {
        var _a, _b, _c, _d, _e;
        const adminRepo = this.connection.getRepository(ctx, core_1.Administrator);
        const admin = await adminRepo.findOne({ where: { id: String(input.administratorId) } });
        if (!admin)
            throw new Error('ADMIN_NOT_FOUND');
        const repo = this.connection.getRepository(ctx, tenant_member_entity_1.TenantMember);
        const chId = String(channelId);
        const existing = await repo.findOne({
            where: { administratorId: String(input.administratorId), channelId: chId },
        });
        if (existing)
            throw new Error('ALREADY_IN_CHANNEL');
        const member = new tenant_member_entity_1.TenantMember();
        member.administratorId = String(input.administratorId);
        member.channelId = chId;
        member.enabled = (_a = input.enabled) !== null && _a !== void 0 ? _a : true;
        member.mustChangePassword = false;
        member.displayName = (_c = (_b = input.displayName) !== null && _b !== void 0 ? _b : admin === null || admin === void 0 ? void 0 : admin.lastName) !== null && _c !== void 0 ? _c : admin === null || admin === void 0 ? void 0 : admin.emailAddress;
        member.phone = (_d = input.phone) !== null && _d !== void 0 ? _d : null;
        member.remark = (_e = input.remark) !== null && _e !== void 0 ? _e : null;
        await repo.save(member);
        await this.syncMemberRolesInChannel(ctx, member.administratorId, chId, input.roleIds || []);
        return this.memberToView(ctx, member);
    }
    /** 租户管理员更新「本 channel」装修类 customFields（仅覆盖传入字段，禁止触碰安全字段） */
    async updateMyChannelCustomFields(ctx, input = {}) {
        const channelId = String(ctx.channelId);
        const channelRepo = this.connection.getRepository(ctx, core_1.Channel);
        const channel = await channelRepo.findOne({ where: { id: channelId } });
        if (!channel)
            throw new Error('CHANNEL_NOT_FOUND');
        // 安全字段禁止租户端越权修改（启停/租户号/官营标记仅超管可改）
        const protectedKeys = ['enabled', 'tenantNo', 'isOfficial'];
        const merged = Object.assign(Object.assign({}, (channel.customFields || {})), Object.fromEntries(Object.entries(input).filter(([k]) => !protectedKeys.includes(k))));
        await this.channelService.update(ctx, { id: channelId, customFields: merged });
        return this.channelService.findOne(ctx, channelId);
    }
};
exports.TenantMemberService = TenantMemberService;
exports.TenantMemberService = TenantMemberService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.AdministratorService,
        core_1.RoleService,
        core_1.ChannelService])
], TenantMemberService);
//# sourceMappingURL=tenant-member.service.js.map