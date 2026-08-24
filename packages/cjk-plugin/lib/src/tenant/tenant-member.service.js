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
exports.TenantMemberService = exports.BUSINESS_PERMISSIONS = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
const tenant_member_entity_1 = require("./tenant-member.entity");
/** 租户级角色可用的业务权限白名单（不含超管专属权限；Vendure v3 已将 Variant/Fulfillment 等合并进 catalog/product/order 权限） */
exports.BUSINESS_PERMISSIONS = [
    core_1.Permission.ReadCatalog,
    core_1.Permission.CreateCatalog,
    core_1.Permission.UpdateCatalog,
    core_1.Permission.DeleteCatalog,
    core_1.Permission.ReadProduct,
    core_1.Permission.CreateProduct,
    core_1.Permission.UpdateProduct,
    core_1.Permission.DeleteProduct,
    core_1.Permission.ReadCollection,
    core_1.Permission.CreateCollection,
    core_1.Permission.UpdateCollection,
    core_1.Permission.DeleteCollection,
    core_1.Permission.ReadOrder,
    core_1.Permission.UpdateOrder,
    core_1.Permission.CreateOrder,
    core_1.Permission.ReadAsset,
    core_1.Permission.CreateAsset,
    core_1.Permission.UpdateAsset,
    core_1.Permission.DeleteAsset,
    core_1.Permission.ReadShippingMethod,
    core_1.Permission.CreateShippingMethod,
    core_1.Permission.UpdateShippingMethod,
    core_1.Permission.DeleteShippingMethod,
    core_1.Permission.ReadPaymentMethod,
    core_1.Permission.CreatePaymentMethod,
    core_1.Permission.UpdatePaymentMethod,
    core_1.Permission.DeletePaymentMethod,
    core_1.Permission.ReadChannel,
    core_1.Permission.UpdateChannel,
    core_1.Permission.ReadAdministrator,
    core_1.Permission.UpdateAdministrator,
    'TenantRoleManage',
    'TenantMemberManage',
    'VerifyOrder',
].map(String);
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
        var _a, _b, _c, _d, _e;
        if (input.roleIds && input.roleIds.length > 0) {
            await this.assertRolesInChannel(ctx, input.roleIds, channelId);
        }
        const admin = await this.administratorService.create(ctx, {
            firstName: (_a = input.firstName) !== null && _a !== void 0 ? _a : '',
            lastName: (_b = input.lastName) !== null && _b !== void 0 ? _b : input.emailAddress,
            emailAddress: input.emailAddress,
            password: input.password,
            roleIds: input.roleIds,
        });
        const repo = this.connection.getRepository(ctx, tenant_member_entity_1.TenantMember);
        const member = new tenant_member_entity_1.TenantMember();
        member.administratorId = String(admin.id);
        member.channelId = String(channelId);
        member.enabled = (_c = input.enabled) !== null && _c !== void 0 ? _c : true;
        member.displayName = (_d = input.displayName) !== null && _d !== void 0 ? _d : input.emailAddress;
        member.remark = (_e = input.remark) !== null && _e !== void 0 ? _e : null;
        await repo.save(member);
        return member;
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