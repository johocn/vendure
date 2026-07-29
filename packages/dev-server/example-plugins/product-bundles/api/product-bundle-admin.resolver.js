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
exports.ProductBundleAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
const product_bundle_entity_1 = require("../entities/product-bundle.entity");
const product_bundle_item_service_1 = require("../services/product-bundle-item.service");
const product_bundle_service_1 = require("../services/product-bundle.service");
let ProductBundleAdminResolver = class ProductBundleAdminResolver {
    constructor(productBundleService, productBundleItemService) {
        this.productBundleService = productBundleService;
        this.productBundleItemService = productBundleItemService;
    }
    async productBundle(ctx, args, relations) {
        return this.productBundleService.findOne(ctx, args.id, relations);
    }
    async productBundles(ctx, args, relations) {
        return this.productBundleService.findAll(ctx, args.options || undefined, relations);
    }
    async createProductBundle(ctx, args) {
        return this.productBundleService.create(ctx, args.input);
    }
    async updateProductBundle(ctx, args) {
        return this.productBundleService.update(ctx, args.input);
    }
    async deleteProductBundle(ctx, args) {
        return this.productBundleService.delete(ctx, args.id);
    }
    createProductBundleItem(ctx, args) {
        return this.productBundleItemService.createProductBundleItem(ctx, args.input);
    }
    updateProductBundleItem(ctx, args) {
        return this.productBundleItemService.updateProductBundleItem(ctx, args.input);
    }
    deleteProductBundleItem(ctx, args) {
        return this.productBundleItemService.delete(ctx, args.id);
    }
};
exports.ProductBundleAdminResolver = ProductBundleAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.productBundlePermission.Read),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __param(2, (0, core_1.Relations)(product_bundle_entity_1.ProductBundle)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array]),
    __metadata("design:returntype", Promise)
], ProductBundleAdminResolver.prototype, "productBundle", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.productBundlePermission.Read),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __param(2, (0, core_1.Relations)(product_bundle_entity_1.ProductBundle)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array]),
    __metadata("design:returntype", Promise)
], ProductBundleAdminResolver.prototype, "productBundles", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(constants_1.productBundlePermission.Create),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ProductBundleAdminResolver.prototype, "createProductBundle", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(constants_1.productBundlePermission.Update),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ProductBundleAdminResolver.prototype, "updateProductBundle", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(constants_1.productBundlePermission.Delete),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ProductBundleAdminResolver.prototype, "deleteProductBundle", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(constants_1.productBundlePermission.Create),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], ProductBundleAdminResolver.prototype, "createProductBundleItem", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(constants_1.productBundlePermission.Update),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], ProductBundleAdminResolver.prototype, "updateProductBundleItem", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(constants_1.productBundlePermission.Delete),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], ProductBundleAdminResolver.prototype, "deleteProductBundleItem", null);
exports.ProductBundleAdminResolver = ProductBundleAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [product_bundle_service_1.ProductBundleService,
        product_bundle_item_service_1.ProductBundleItemService])
], ProductBundleAdminResolver);
//# sourceMappingURL=product-bundle-admin.resolver.js.map