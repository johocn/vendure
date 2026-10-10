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
exports.PointsMallShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const points_mall_service_1 = require("./points-mall.service");
let PointsMallShopResolver = class PointsMallShopResolver {
    constructor(pointsMallService) {
        this.pointsMallService = pointsMallService;
    }
    /** 游客可浏览积分商城列表（对齐 usemall），不加 @Allow。 */
    async pointsProducts(ctx, options) {
        return this.pointsMallService.shopPointsProducts(ctx, options);
    }
    /** 游客可看详情，不加 @Allow。 */
    async pointsProduct(ctx, id) {
        return this.pointsMallService.shopPointsProduct(ctx, id);
    }
    async myFavorites(ctx, options) {
        return this.pointsMallService.myFavorites(ctx, options);
    }
    /** 游客可看收藏元信息（service 内部处理未登录），不加 @Allow。 */
    async productFavoriteMeta(ctx, productId) {
        return this.pointsMallService.favoriteMeta(ctx, productId);
    }
    async myPointsOrders(ctx, options) {
        return this.pointsMallService.myPointsOrders(ctx, options);
    }
    async myPointsOrder(ctx, id) {
        return this.pointsMallService.myPointsOrder(ctx, id);
    }
    async toggleProductFavorite(ctx, productId) {
        return this.pointsMallService.toggleProductFavorite(ctx, productId);
    }
    async createPointsOrderExchange(ctx, input) {
        return this.pointsMallService.createPointsOrderExchange(ctx, input);
    }
    /** 拉取外部微信支付接口，不在 DB 事务内。 */
    async createPointsOrderPayment(ctx, pointsOrderId, tradeType, openid) {
        return this.pointsMallService.createPointsOrderPayment(ctx, pointsOrderId, tradeType, openid);
    }
    async cancelPointsOrder(ctx, id) {
        return this.pointsMallService.cancelPointsOrder(ctx, id);
    }
};
exports.PointsMallShopResolver = PointsMallShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PointsMallShopResolver.prototype, "pointsProducts", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PointsMallShopResolver.prototype, "pointsProduct", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PointsMallShopResolver.prototype, "myFavorites", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PointsMallShopResolver.prototype, "productFavoriteMeta", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PointsMallShopResolver.prototype, "myPointsOrders", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PointsMallShopResolver.prototype, "myPointsOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PointsMallShopResolver.prototype, "toggleProductFavorite", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PointsMallShopResolver.prototype, "createPointsOrderExchange", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('pointsOrderId')),
    __param(2, (0, graphql_1.Args)('tradeType', { nullable: true })),
    __param(3, (0, graphql_1.Args)('openid', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String, String]),
    __metadata("design:returntype", Promise)
], PointsMallShopResolver.prototype, "createPointsOrderPayment", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PointsMallShopResolver.prototype, "cancelPointsOrder", null);
exports.PointsMallShopResolver = PointsMallShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [points_mall_service_1.PointsMallService])
], PointsMallShopResolver);
//# sourceMappingURL=points-mall-shop.resolver.js.map