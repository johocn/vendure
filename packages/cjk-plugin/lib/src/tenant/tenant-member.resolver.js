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
exports.TenantMemberResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const common_1 = require("@nestjs/common");
const tenant_member_service_1 = require("./tenant-member.service");
const tenant_member_entity_1 = require("./tenant-member.entity");
const tenant_permissions_1 = require("./tenant-permissions");
/**
 * 租户管理员 API：所有操作强制限定在 ctx.channelId（当前请求租户）。
 */
let TenantMemberResolver = class TenantMemberResolver {
    constructor(roleService, connection, tenantMemberService) {
        this.roleService = roleService;
        this.connection = connection;
        this.tenantMemberService = tenantMemberService;
    }
    async tenantMembers(ctx) {
        this.tenantMemberService.assertChannelMember(ctx);
        const repo = this.connection.getRepository(ctx, tenant_member_entity_1.TenantMember);
        return repo.find({ where: { channelId: String(ctx.channelId) }, order: { createdAt: 'ASC' } });
    }
    async createTenantMember(ctx, args) {
        this.tenantMemberService.assertChannelMember(ctx);
        return this.tenantMemberService.createTenantAdministrator(ctx, ctx.channelId, args.input);
    }
    async setTenantMemberEnabled(ctx, args) {
        this.tenantMemberService.assertChannelMember(ctx);
        await this.tenantMemberService.setMemberEnabled(ctx, ctx.channelId, args.id, args.enabled);
        const repo = this.connection.getRepository(ctx, tenant_member_entity_1.TenantMember);
        return repo.findOne({ where: { id: args.id } });
    }
    async deleteTenantMember(ctx, id) {
        this.tenantMemberService.assertChannelMember(ctx);
        await this.tenantMemberService.removeMember(ctx, ctx.channelId, id);
        return true;
    }
    async permissionCatalog() {
        return tenant_member_service_1.PERMISSION_CATALOG;
    }
    async myTenantRoles(ctx) {
        this.tenantMemberService.assertChannelMember(ctx);
        const result = await this.roleService.findAll(ctx);
        const chId = String(ctx.channelId);
        return result.items.filter((r) => (r.channels || []).some((c) => String(c.id) === chId));
    }
    async myUpdateChannelCustomFields(ctx, input) {
        this.tenantMemberService.assertChannelMember(ctx);
        return this.tenantMemberService.updateMyChannelCustomFields(ctx, input);
    }
    async myCreateTenantRole(ctx, args) {
        this.tenantMemberService.assertChannelMember(ctx);
        return this.tenantMemberService.createTenantRole(ctx, ctx.channelId, args.input);
    }
    async myUpdateTenantRole(ctx, args) {
        this.tenantMemberService.assertChannelMember(ctx);
        return this.tenantMemberService.updateTenantRole(ctx, args.roleId, args.input, ctx.channelId);
    }
    async myDeleteTenantRole(ctx, roleId) {
        this.tenantMemberService.assertChannelMember(ctx);
        await this.tenantMemberService.deleteTenantRole(ctx, roleId, ctx.channelId);
        return true;
    }
    /** 当前登录者修改自身密码（首登强改密时清标志） */
    async tenantChangeMyPassword(ctx, newPassword) {
        await this.tenantMemberService.changeMyPassword(ctx, newPassword);
        return true;
    }
};
exports.TenantMemberResolver = TenantMemberResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], TenantMemberResolver.prototype, "tenantMembers", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(tenant_permissions_1.tenantMemberManagePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TenantMemberResolver.prototype, "createTenantMember", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(tenant_permissions_1.tenantMemberManagePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TenantMemberResolver.prototype, "setTenantMemberEnabled", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(tenant_permissions_1.tenantMemberManagePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], TenantMemberResolver.prototype, "deleteTenantMember", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TenantMemberResolver.prototype, "permissionCatalog", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], TenantMemberResolver.prototype, "myTenantRoles", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TenantMemberResolver.prototype, "myUpdateChannelCustomFields", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(tenant_permissions_1.tenantRoleManagePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TenantMemberResolver.prototype, "myCreateTenantRole", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(tenant_permissions_1.tenantRoleManagePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TenantMemberResolver.prototype, "myUpdateTenantRole", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(tenant_permissions_1.tenantRoleManagePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('roleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], TenantMemberResolver.prototype, "myDeleteTenantRole", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('newPassword')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], TenantMemberResolver.prototype, "tenantChangeMyPassword", null);
exports.TenantMemberResolver = TenantMemberResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __param(0, (0, common_1.Inject)(core_1.RoleService)),
    __param(1, (0, common_1.Inject)(core_1.TransactionalConnection)),
    __param(2, (0, common_1.Inject)(tenant_member_service_1.TenantMemberService)),
    __metadata("design:paramtypes", [core_1.RoleService,
        core_1.TransactionalConnection,
        tenant_member_service_1.TenantMemberService])
], TenantMemberResolver);
//# sourceMappingURL=tenant-member.resolver.js.map