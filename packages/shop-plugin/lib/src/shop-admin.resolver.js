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
exports.ShopAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const shop_entity_1 = require("./shop.entity");
const shop_service_1 = require("./shop.service");
let ShopAdminResolver = class ShopAdminResolver {
    constructor(shopService) {
        this.shopService = shopService;
    }
    async shops(ctx, options) {
        return this.shopService.shops(ctx, options);
    }
    async shopById(ctx, id) {
        return this.shopService.getShop(ctx, id);
    }
    async createShop(ctx, input) {
        return this.shopService.createShop(ctx, input);
    }
    async updateShop(ctx, id, input) {
        return this.shopService.updateShop(ctx, id, input);
    }
    async setShopStatus(ctx, id, status) {
        return this.shopService.setShopStatus(ctx, id, status);
    }
    async assignProductsToShop(ctx, input) {
        return this.shopService.assignProductsToShop(ctx, input);
    }
    async unassignProductsFromShop(ctx, input) {
        return this.shopService.unassignProductsFromShop(ctx, input);
    }
    async recomputeShopRating(ctx, id) {
        return this.shopService.recomputeShopRating(ctx, id);
    }
    async rating(ctx, shop) {
        return this.shopService.getShopRatingCachedOrCompute(ctx, shop);
    }
    async productCount(ctx, shop) {
        const r = await this.shopService.getShopRatingCachedOrCompute(ctx, shop);
        return r.productCount;
    }
    async products(ctx, shop, options) {
        return this.shopService.getShopProducts(ctx, shop.id, options);
    }
};
exports.ShopAdminResolver = ShopAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShopAdminResolver.prototype, "shops", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShopAdminResolver.prototype, "shopById", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShopAdminResolver.prototype, "createShop", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], ShopAdminResolver.prototype, "updateShop", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], ShopAdminResolver.prototype, "setShopStatus", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShopAdminResolver.prototype, "assignProductsToShop", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShopAdminResolver.prototype, "unassignProductsFromShop", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShopAdminResolver.prototype, "recomputeShopRating", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, shop_entity_1.Shop]),
    __metadata("design:returntype", Promise)
], ShopAdminResolver.prototype, "rating", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, shop_entity_1.Shop]),
    __metadata("design:returntype", Promise)
], ShopAdminResolver.prototype, "productCount", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Parent)()),
    __param(2, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext,
        shop_entity_1.Shop, Object]),
    __metadata("design:returntype", Promise)
], ShopAdminResolver.prototype, "products", null);
exports.ShopAdminResolver = ShopAdminResolver = __decorate([
    (0, graphql_1.Resolver)('Shop'),
    __metadata("design:paramtypes", [shop_service_1.ShopService])
], ShopAdminResolver);
//# sourceMappingURL=shop-admin.resolver.js.map