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
exports.ShopTemplateAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const shop_template_service_1 = require("./shop-template.service");
const permissions_1 = require("./permissions");
let ShopTemplateAdminResolver = class ShopTemplateAdminResolver {
    constructor(service) {
        this.service = service;
    }
    async shopTemplates(ctx, app) {
        return this.service.findAll(ctx, app);
    }
    async shopTemplate(ctx, id) {
        return this.service.findOne(ctx, id);
    }
    async createShopTemplate(ctx, input) {
        return this.service.create(ctx, input);
    }
    async updateShopTemplate(ctx, input) {
        return this.service.update(ctx, input);
    }
    async deleteShopTemplate(ctx, id) {
        return this.service.delete(ctx, id);
    }
    async copyShopTemplate(ctx, id) {
        return this.service.copy(ctx, id);
    }
    async shopGlobalConfig(ctx, app) {
        return this.service.findGlobalConfig(ctx, app);
    }
    async updateShopGlobalConfig(ctx, input) {
        return this.service.upsertGlobalConfig(ctx, input);
    }
};
exports.ShopTemplateAdminResolver = ShopTemplateAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.shopTemplatesRead.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('app')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], ShopTemplateAdminResolver.prototype, "shopTemplates", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.shopTemplatesRead.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShopTemplateAdminResolver.prototype, "shopTemplate", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(permissions_1.shopTemplatesCreate.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShopTemplateAdminResolver.prototype, "createShopTemplate", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(permissions_1.shopTemplatesUpdate.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShopTemplateAdminResolver.prototype, "updateShopTemplate", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(permissions_1.shopTemplatesDelete.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShopTemplateAdminResolver.prototype, "deleteShopTemplate", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(permissions_1.shopTemplatesCreate.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShopTemplateAdminResolver.prototype, "copyShopTemplate", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.shopTemplatesRead.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('app')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], ShopTemplateAdminResolver.prototype, "shopGlobalConfig", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(permissions_1.shopTemplatesUpdate.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShopTemplateAdminResolver.prototype, "updateShopGlobalConfig", null);
exports.ShopTemplateAdminResolver = ShopTemplateAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [shop_template_service_1.ShopTemplateService])
], ShopTemplateAdminResolver);
//# sourceMappingURL=shop-template-admin.resolver.js.map