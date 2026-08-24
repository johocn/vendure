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
exports.TenantMemberService = exports.BUSINESS_PERMISSIONS = exports.PERMISSION_CATALOG = void 0;
exports.randomStrongPassword = randomStrongPassword;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
const tenant_member_entity_1 = require("./tenant-member.entity");
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
    /** 建租户（Channel）——仅超管调用 */
    async createChannel(ctx, input) {
        var _a, _b;
        const channel = await this.channelService.create(ctx, {
            code: input.code,
            token: input.token,
            defaultLanguageCode: 'zh_Hans',
            currencyCode: 'CNY',
            pricesIncludeTax: true,
            customFields: {
                tenantNo: (_a = input.tenantNo) !== null && _a !== void 0 ? _a : null,
                isOfficial: (_b = input.isOfficial) !== null && _b !== void 0 ? _b : false,
                enabled: true,
                shopName: input.name,
            },
        });
        core_1.Logger.info(`已创建租户 ${input.code}`, constants_1.loggerCtx);
        return channel;
    }
    /** 租户启停（仅超管） */
    async setChannelEnabled(ctx, channelId, enabled) {
        await this.channelService.update(ctx, {
            id: channelId,
            customFields: { enabled },
        });
    }
    /** 更新租户基础信息（仅超管） */
    async updateChannel(ctx, channelId, input) {
        await this.channelService.update(ctx, {
            id: channelId,
            customFields: {
                tenantNo: input.tenantNo,
                isOfficial: input.isOfficial,
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
    /** 超管为租户建管理员账号并绑定角色，同时写入 TenantMember */
    async createTenantAdministrator(ctx, channelId, input) {
        var _a, _b, _c, _d, _e, _f;
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