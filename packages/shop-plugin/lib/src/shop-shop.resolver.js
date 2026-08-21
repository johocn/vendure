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
exports.ShopShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const shop_entity_1 = require("./shop.entity");
const shop_service_1 = require("./shop.service");
let ShopShopResolver = class ShopShopResolver {
    constructor(shopService) {
        this.shopService = shopService;
    }
    async shops(ctx, options) {
        return this.shopService.getActiveShops(ctx, options);
    }
    async shop(ctx, slug) {
        return this.shopService.getShopBySlug(ctx, slug);
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
exports.ShopShopResolver = ShopShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShopShopResolver.prototype, "shops", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], ShopShopResolver.prototype, "shop", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, shop_entity_1.Shop]),
    __metadata("design:returntype", Promise)
], ShopShopResolver.prototype, "rating", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, shop_entity_1.Shop]),
    __metadata("design:returntype", Promise)
], ShopShopResolver.prototype, "productCount", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Parent)()),
    __param(2, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext,
        shop_entity_1.Shop, Object]),
    __metadata("design:returntype", Promise)
], ShopShopResolver.prototype, "products", null);
exports.ShopShopResolver = ShopShopResolver = __decorate([
    (0, graphql_1.Resolver)('Shop'),
    __metadata("design:paramtypes", [shop_service_1.ShopService])
], ShopShopResolver);
//# sourceMappingURL=shop-shop.resolver.js.map