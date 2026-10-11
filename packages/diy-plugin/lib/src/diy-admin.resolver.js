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
exports.DiyAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const permissions_1 = require("./permissions");
const diy_service_1 = require("./diy.service");
let DiyAdminResolver = class DiyAdminResolver {
    constructor(service) {
        this.service = service;
    }
    /* ------------------------------ 分类 ------------------------------ */
    async diyCategories(ctx, app) {
        return this.service.findCategories(ctx, app === undefined ? undefined : app !== null && app !== void 0 ? app : null);
    }
    async diyCategory(ctx, id) {
        return this.service.findOneCategory(ctx, id);
    }
    async createDiyCategory(ctx, input) {
        return this.service.createCategory(ctx, input);
    }
    async updateDiyCategory(ctx, input) {
        return this.service.updateCategory(ctx, input);
    }
    async deleteDiyCategory(ctx, id) {
        return this.service.deleteCategory(ctx, id);
    }
    /* ------------------------------ 素材 ------------------------------ */
    async diyMaterials(ctx, app, skip, take) {
        return this.service.findMaterials(ctx, app === undefined ? undefined : app !== null && app !== void 0 ? app : null, skip !== null && skip !== void 0 ? skip : 0, take !== null && take !== void 0 ? take : 100);
    }
    async diyMaterial(ctx, id) {
        return this.service.findOneMaterial(ctx, id);
    }
    async createDiyMaterial(ctx, input) {
        return this.service.createMaterial(ctx, input);
    }
    async updateDiyMaterial(ctx, input) {
        return this.service.updateMaterial(ctx, input);
    }
    async deleteDiyMaterial(ctx, id) {
        return this.service.deleteMaterial(ctx, id);
    }
    async copyDiyMaterial(ctx, id) {
        return this.service.copyMaterial(ctx, id);
    }
    async diyMaterialsImport(ctx, input) {
        return this.service.importMaterials(ctx, input);
    }
    /* ------------------------------ 模板 ------------------------------ */
    async diyTemplates(ctx, app) {
        return this.service.findTemplates(ctx, app === undefined ? undefined : app !== null && app !== void 0 ? app : null);
    }
    async diyTemplate(ctx, id) {
        return this.service.findOneTemplate(ctx, id);
    }
    async createDiyTemplate(ctx, input) {
        return this.service.createTemplate(ctx, input);
    }
    async updateDiyTemplate(ctx, input) {
        return this.service.updateTemplate(ctx, input);
    }
    async deleteDiyTemplate(ctx, id) {
        return this.service.deleteTemplate(ctx, id);
    }
    async publishDiyTemplate(ctx, id) {
        return this.service.publishTemplate(ctx, id);
    }
    async copyDiyTemplate(ctx, id) {
        return this.service.copyTemplate(ctx, id);
    }
    /* ------------------------------ 方案 ------------------------------ */
    async diyPlans(ctx, app, status, skip, take) {
        return this.service.findPlans(ctx, { app, status, skip, take });
    }
};
exports.DiyAdminResolver = DiyAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.DiyRead.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('app', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "diyCategories", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.DiyRead.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "diyCategory", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(permissions_1.DiyCreate.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "createDiyCategory", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(permissions_1.DiyUpdate.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "updateDiyCategory", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(permissions_1.DiyDelete.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "deleteDiyCategory", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.DiyRead.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('app', { nullable: true })),
    __param(2, (0, graphql_1.Args)('skip', { nullable: true })),
    __param(3, (0, graphql_1.Args)('take', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Number, Number]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "diyMaterials", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.DiyRead.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "diyMaterial", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(permissions_1.DiyCreate.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "createDiyMaterial", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(permissions_1.DiyUpdate.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "updateDiyMaterial", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(permissions_1.DiyDelete.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "deleteDiyMaterial", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(permissions_1.DiyCreate.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "copyDiyMaterial", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(permissions_1.DiyUpdate.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "diyMaterialsImport", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.DiyRead.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('app', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "diyTemplates", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.DiyRead.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "diyTemplate", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(permissions_1.DiyCreate.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "createDiyTemplate", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(permissions_1.DiyUpdate.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "updateDiyTemplate", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(permissions_1.DiyDelete.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "deleteDiyTemplate", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(permissions_1.DiyUpdate.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "publishDiyTemplate", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(permissions_1.DiyCreate.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "copyDiyTemplate", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.DiyRead.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('app', { nullable: true })),
    __param(2, (0, graphql_1.Args)('status', { nullable: true })),
    __param(3, (0, graphql_1.Args)('skip', { nullable: true, defaultValue: 0 })),
    __param(4, (0, graphql_1.Args)('take', { nullable: true, defaultValue: 50 })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String, Number, Number]),
    __metadata("design:returntype", Promise)
], DiyAdminResolver.prototype, "diyPlans", null);
exports.DiyAdminResolver = DiyAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [diy_service_1.DiyService])
], DiyAdminResolver);
//# sourceMappingURL=diy-admin.resolver.js.map