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
exports.MerchantResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const merchant_permissions_1 = require("./merchant-permissions");
const shop_service_1 = require("./shop.service");
/**
 * 店主自营后台（ADMIN API）。全部能力 @Allow(manageOwnShop.Permission) 把关「店主管理员」，
 * 归属隔离（Shop.administratorId / Product.shopId）由 service 层二次把关。
 * provisionShopOwner 为平台侧能力（UpdateSettings）。
 */
let MerchantResolver = class MerchantResolver {
    constructor(shopService) {
        this.shopService = shopService;
    }
    async myShop(ctx) {
        return this.shopService.requireMyShop(ctx);
    }
    async myShopProducts(ctx, options) {
        return this.shopService.getMyShopProducts(ctx, options);
    }
    async myShopOrders(ctx) {
        return this.shopService.getMyShopOrders(ctx);
    }
    async myShopOrder(ctx, orderId) {
        return this.shopService.getMyShopOrder(ctx, orderId);
    }
    async myShopOrderFulfillments(ctx, orderId) {
        return this.shopService.getMyShopOrderFulfillments(ctx, orderId);
    }
    async fulfillMyShopOrder(ctx, orderId, lines, method, trackingCode) {
        return this.shopService.fulfillMyShopOrder(ctx, orderId, method, trackingCode, lines);
    }
    async myShopReviews(ctx) {
        return this.shopService.getMyShopReviews(ctx);
    }
    async provisionShopOwner(ctx, shopId, input) {
        return this.shopService.provisionShopOwner(ctx, shopId, input);
    }
    async updateMyShop(ctx, input) {
        return this.shopService.updateMyShop(ctx, input);
    }
    async addProductToMyShop(ctx, productId) {
        return this.shopService.addProductToMyShop(ctx, productId);
    }
    async removeProductFromMyShop(ctx, productId) {
        return this.shopService.removeProductFromMyShop(ctx, productId);
    }
    async updateMyShopProduct(ctx, productId, input) {
        return this.shopService.updateMyShopProduct(ctx, productId, input);
    }
    async setMyShopProductEnabled(ctx, productId, enabled) {
        return this.shopService.setMyShopProductEnabled(ctx, productId, enabled);
    }
    async approveMerchantReview(ctx, id) {
        return this.shopService.approveMerchantReview(ctx, id);
    }
    async rejectMerchantReview(ctx, id) {
        return this.shopService.rejectMerchantReview(ctx, id);
    }
};
exports.MerchantResolver = MerchantResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(merchant_permissions_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], MerchantResolver.prototype, "myShop", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(merchant_permissions_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantResolver.prototype, "myShopProducts", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(merchant_permissions_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], MerchantResolver.prototype, "myShopOrders", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(merchant_permissions_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantResolver.prototype, "myShopOrder", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(merchant_permissions_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantResolver.prototype, "myShopOrderFulfillments", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(merchant_permissions_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('lines', { nullable: true })),
    __param(3, (0, graphql_1.Args)('method', { type: () => String, nullable: true })),
    __param(4, (0, graphql_1.Args)('trackingCode', { type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array, String, String]),
    __metadata("design:returntype", Promise)
], MerchantResolver.prototype, "fulfillMyShopOrder", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(merchant_permissions_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], MerchantResolver.prototype, "myShopReviews", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('shopId')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], MerchantResolver.prototype, "provisionShopOwner", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(merchant_permissions_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantResolver.prototype, "updateMyShop", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(merchant_permissions_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantResolver.prototype, "addProductToMyShop", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(merchant_permissions_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantResolver.prototype, "removeProductFromMyShop", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(merchant_permissions_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], MerchantResolver.prototype, "updateMyShopProduct", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(merchant_permissions_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __param(2, (0, graphql_1.Args)('enabled')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Boolean]),
    __metadata("design:returntype", Promise)
], MerchantResolver.prototype, "setMyShopProductEnabled", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(merchant_permissions_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantResolver.prototype, "approveMerchantReview", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(merchant_permissions_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantResolver.prototype, "rejectMerchantReview", null);
exports.MerchantResolver = MerchantResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [shop_service_1.ShopService])
], MerchantResolver);
//# sourceMappingURL=merchant-resolver.js.map