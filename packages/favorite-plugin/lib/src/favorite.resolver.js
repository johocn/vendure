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
exports.FavoriteShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const favorite_service_1 = require("./favorite.service");
let FavoriteShopResolver = class FavoriteShopResolver {
    constructor(favoriteService) {
        this.favoriteService = favoriteService;
    }
    async myFavoriteProducts(ctx) {
        return this.favoriteService.myFavoriteProducts(ctx);
    }
    async myFollowedShops(ctx) {
        return this.favoriteService.myFollowedShops(ctx);
    }
    async isProductFavorite(ctx, productId) {
        return this.favoriteService.isProductFavorite(ctx, productId);
    }
    async isShopFollowed(ctx, shopId) {
        return this.favoriteService.isShopFollowed(ctx, shopId);
    }
    async shopFollowerCount(ctx, shopId) {
        return this.favoriteService.shopFollowerCount(ctx, shopId);
    }
    async toggleFavoriteProduct(ctx, productId) {
        return this.favoriteService.toggleProductFavorite(ctx, productId);
    }
    async toggleFollowShop(ctx, shopId) {
        return this.favoriteService.toggleShopFollow(ctx, shopId);
    }
};
exports.FavoriteShopResolver = FavoriteShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], FavoriteShopResolver.prototype, "myFavoriteProducts", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], FavoriteShopResolver.prototype, "myFollowedShops", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], FavoriteShopResolver.prototype, "isProductFavorite", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('shopId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], FavoriteShopResolver.prototype, "isShopFollowed", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('shopId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], FavoriteShopResolver.prototype, "shopFollowerCount", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], FavoriteShopResolver.prototype, "toggleFavoriteProduct", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('shopId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], FavoriteShopResolver.prototype, "toggleFollowShop", null);
exports.FavoriteShopResolver = FavoriteShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [favorite_service_1.FavoriteService])
], FavoriteShopResolver);
//# sourceMappingURL=favorite.resolver.js.map