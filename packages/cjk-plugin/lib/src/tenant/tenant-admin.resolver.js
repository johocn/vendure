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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const common_1 = require("@nestjs/common");
const tenant_member_service_1 = require("./tenant-member.service");
const tenant_member_entity_1 = require("./tenant-member.entity");
let TenantAdminResolver = class TenantAdminResolver {
    constructor(channelService, roleService, connection, tenantMemberService) {
        this.channelService = channelService;
        this.roleService = roleService;
        this.connection = connection;
        this.tenantMemberService = tenantMemberService;
    }
    async tenants(ctx, args) {
        var _a, _b, _c, _d;
        const result = await this.channelService.findAll(ctx, {
            skip: (_b = (_a = args.options) === null || _a === void 0 ? void 0 : _a.skip) !== null && _b !== void 0 ? _b : 0,
            take: (_d = (_c = args.options) === null || _c === void 0 ? void 0 : _c.take) !== null && _d !== void 0 ? _d : 50,
        });
        return result;
    }
    async tenant(ctx, id) {
        return this.channelService.findOne(ctx, id);
    }
    async createTenant(ctx, args) {
        return this.tenantMemberService.createChannel(ctx, args.input);
    }
    async updateTenant(ctx, args) {
        await this.tenantMemberService.updateChannel(ctx, args.id, args.input);
        return this.channelService.findOne(ctx, args.id);
    }
    async setTenantEnabled(ctx, args) {
        await this.tenantMemberService.setChannelEnabled(ctx, args.id, args.enabled);
        return this.channelService.findOne(ctx, args.id);
    }
    /** 软删：标记停用，不做物理删除 */
    async deleteTenant(ctx, id) {
        await this.tenantMemberService.setChannelEnabled(ctx, id, false);
        return true;
    }
    async tenantAdministrators(ctx, channelId) {
        const repo = this.connection.getRepository(ctx, tenant_member_entity_1.TenantMember);
        const members = await repo.find({ where: { channelId }, order: { createdAt: 'ASC' } });
        return Promise.all(members.map((m) => this.tenantMemberService.memberToView(ctx, m)));
    }
    async createTenantAdministrator(ctx, args) {
        return this.tenantMemberService.createTenantAdministrator(ctx, args.channelId, args.input);
    }
    async setTenantAdministratorEnabled(ctx, args) {
        const repo = this.connection.getRepository(ctx, tenant_member_entity_1.TenantMember);
        const member = await repo.findOne({ where: { id: args.id } });
        if (!member)
            throw new Error('MEMBER_NOT_FOUND');
        await this.tenantMemberService.setMemberEnabled(ctx, member.channelId, args.id, args.enabled);
        return repo.findOne({ where: { id: args.id } });
    }
    async deleteTenantAdministrator(ctx, id) {
        const repo = this.connection.getRepository(ctx, tenant_member_entity_1.TenantMember);
        const member = await repo.findOne({ where: { id } });
        if (!member)
            throw new Error('MEMBER_NOT_FOUND');
        await this.tenantMemberService.removeMember(ctx, member.channelId, id);
        return true;
    }
    async tenantRoles(ctx, channelId) {
        const result = await this.roleService.findAll(ctx);
        const chId = String(channelId);
        return result.items.filter((r) => (r.channels || []).some((c) => String(c.id) === chId));
    }
    async createTenantRole(ctx, args) {
        return this.tenantMemberService.createTenantRole(ctx, args.channelId, args.input);
    }
    async updateTenantRole(ctx, args) {
        return this.tenantMemberService.updateTenantRole(ctx, args.roleId, args.input);
    }
    async deleteTenantRole(ctx, roleId) {
        await this.tenantMemberService.deleteTenantRole(ctx, roleId);
        return true;
    }
    async updateTenantMemberRoles(ctx, args) {
        await this.tenantMemberService.updateTenantMemberRoles(ctx, args.channelId, args.id, args.roleIds);
        return true;
    }
    async tenantSearchAdmins(ctx, args) {
        return this.tenantMemberService.searchAdmins(ctx, args.channelId, args.keyword, 10);
    }
    async tenantLinkMember(ctx, args) {
        return this.tenantMemberService.linkMember(ctx, args.channelId, {
            administratorId: args.administratorId,
            roleIds: args.roleIds,
            displayName: args.displayName,
            phone: args.phone,
            remark: args.remark,
        });
    }
    async importDefaultRoles(ctx, channelId) {
        return this.tenantMemberService.importDefaultRoles(ctx, channelId);
    }
};
exports.TenantAdminResolver = TenantAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TenantAdminResolver.prototype, "tenants", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], TenantAdminResolver.prototype, "tenant", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TenantAdminResolver.prototype, "createTenant", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TenantAdminResolver.prototype, "updateTenant", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TenantAdminResolver.prototype, "setTenantEnabled", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], TenantAdminResolver.prototype, "deleteTenant", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('channelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], TenantAdminResolver.prototype, "tenantAdministrators", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TenantAdminResolver.prototype, "createTenantAdministrator", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TenantAdminResolver.prototype, "setTenantAdministratorEnabled", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], TenantAdminResolver.prototype, "deleteTenantAdministrator", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('channelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], TenantAdminResolver.prototype, "tenantRoles", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TenantAdminResolver.prototype, "createTenantRole", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TenantAdminResolver.prototype, "updateTenantRole", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('roleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], TenantAdminResolver.prototype, "deleteTenantRole", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TenantAdminResolver.prototype, "updateTenantMemberRoles", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TenantAdminResolver.prototype, "tenantSearchAdmins", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TenantAdminResolver.prototype, "tenantLinkMember", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('channelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], TenantAdminResolver.prototype, "importDefaultRoles", null);
exports.TenantAdminResolver = TenantAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __param(0, (0, common_1.Inject)(core_1.ChannelService)),
    __param(1, (0, common_1.Inject)(core_1.RoleService)),
    __param(2, (0, common_1.Inject)(core_1.TransactionalConnection)),
    __param(3, (0, common_1.Inject)(tenant_member_service_1.TenantMemberService)),
    __metadata("design:paramtypes", [core_1.ChannelService,
        core_1.RoleService,
        core_1.TransactionalConnection,
        tenant_member_service_1.TenantMemberService])
], TenantAdminResolver);
//# sourceMappingURL=tenant-admin.resolver.js.map