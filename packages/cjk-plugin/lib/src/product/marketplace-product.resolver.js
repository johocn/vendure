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
exports.MarketplaceProductResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const marketplace_product_service_1 = require("./marketplace-product.service");
const marketplace_permissions_1 = require("./marketplace-permissions");
let MarketplaceProductResolver = class MarketplaceProductResolver {
    constructor(service) {
        this.service = service;
    }
    async submitProductToMarketplace(ctx, id) {
        await this.service.submitToMarketplace(ctx, id);
        return this.service.findOneView(ctx, id);
    }
    async reviewMarketplaceProduct(ctx, id, approve, rejectReason) {
        await this.service.review(ctx, id, approve, rejectReason);
        return this.service.findOneView(ctx, id);
    }
    async marketplaceProducts(ctx, status) {
        return this.service.findByStatus(ctx, status);
    }
};
exports.MarketplaceProductResolver = MarketplaceProductResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin, marketplace_permissions_1.platformProductReviewPermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id', { type: () => String })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], MarketplaceProductResolver.prototype, "submitProductToMarketplace", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin, marketplace_permissions_1.platformProductReviewPermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id', { type: () => String })),
    __param(2, (0, graphql_1.Args)('approve', { type: () => Boolean })),
    __param(3, (0, graphql_1.Args)('rejectReason', { type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Boolean, Object]),
    __metadata("design:returntype", Promise)
], MarketplaceProductResolver.prototype, "reviewMarketplaceProduct", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin, marketplace_permissions_1.platformProductReviewPermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('status', { type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MarketplaceProductResolver.prototype, "marketplaceProducts", null);
exports.MarketplaceProductResolver = MarketplaceProductResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [marketplace_product_service_1.MarketplaceProductService])
], MarketplaceProductResolver);
//# sourceMappingURL=marketplace-product.resolver.js.map