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
exports.TenantCatalogAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const tenant_catalog_service_1 = require("./tenant-catalog.service");
const tenant_option_group_service_1 = require("./tenant-option-group.service");
let TenantCatalogAdminResolver = class TenantCatalogAdminResolver {
    constructor(tenantCatalogService, optionGroupService) {
        this.tenantCatalogService = tenantCatalogService;
        this.optionGroupService = optionGroupService;
    }
    async createTenantCollection(ctx, input) {
        return this.tenantCatalogService.createTenantCollection(ctx, input);
    }
    async mapProductToPlatformCollection(ctx, productId, collectionId) {
        await this.tenantCatalogService.addProductToCollection(ctx, productId, collectionId);
        return true;
    }
    async moveProductsToTenantChannel(ctx, productIds, channelId) {
        const moved = await this.tenantCatalogService.moveProductsToTenantChannel(ctx, productIds, channelId);
        return moved.length;
    }
    async reusableOptionGroups(ctx) {
        return this.optionGroupService.reusableOptionGroups(ctx);
    }
    async reuseOptionGroupForProduct(productId, optionGroupId) {
        return this.optionGroupService.reuseOptionGroupForProduct(productId, optionGroupId);
    }
};
exports.TenantCatalogAdminResolver = TenantCatalogAdminResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.CreateCatalog, core_1.Permission.CreateCollection),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TenantCatalogAdminResolver.prototype, "createTenantCollection", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCatalog, core_1.Permission.UpdateProduct),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __param(2, (0, graphql_1.Args)('collectionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String]),
    __metadata("design:returntype", Promise)
], TenantCatalogAdminResolver.prototype, "mapProductToPlatformCollection", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCatalog, core_1.Permission.UpdateProduct),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productIds')),
    __param(2, (0, graphql_1.Args)('channelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array, String]),
    __metadata("design:returntype", Promise)
], TenantCatalogAdminResolver.prototype, "moveProductsToTenantChannel", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog, core_1.Permission.ReadProduct),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], TenantCatalogAdminResolver.prototype, "reusableOptionGroups", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCatalog, core_1.Permission.UpdateProduct),
    __param(0, (0, graphql_1.Args)('productId')),
    __param(1, (0, graphql_1.Args)('optionGroupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TenantCatalogAdminResolver.prototype, "reuseOptionGroupForProduct", null);
exports.TenantCatalogAdminResolver = TenantCatalogAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [tenant_catalog_service_1.TenantCatalogService,
        tenant_option_group_service_1.TenantOptionGroupService])
], TenantCatalogAdminResolver);
//# sourceMappingURL=tenant-catalog-admin.resolver.js.map