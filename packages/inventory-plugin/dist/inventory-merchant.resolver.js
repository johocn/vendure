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
exports.InventoryMerchantResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const shop_plugin_1 = require("@vendure/shop-plugin");
const inventory_service_1 = require("./inventory.service");
/**
 * 店主自营库存（ADMIN API，阶段47）。全部 @Allow(manageOwnShop) 把关「店主管理员」，
 * 归属隔离（Shop.administratorId / Product.customFields.shopId）由 service 层二次把关。
 * 复用 shop-plugin 的 manageOwnShop 权限定义，与店主店铺/结算同权。
 */
let InventoryMerchantResolver = class InventoryMerchantResolver {
    constructor(inventoryService) {
        this.inventoryService = inventoryService;
    }
    async myShopStock(ctx, productId) {
        return this.inventoryService.getMyShopStock(ctx, productId);
    }
    async myShopProductStock(ctx, productId) {
        return this.inventoryService.myShopProductStock(ctx, productId);
    }
    async myShopStockAdjust(ctx, variantId, stockLocationId, stockOnHand) {
        return this.inventoryService.adjustMyShopStock(ctx, variantId, stockLocationId, stockOnHand);
    }
};
exports.InventoryMerchantResolver = InventoryMerchantResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryMerchantResolver.prototype, "myShopStock", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InventoryMerchantResolver.prototype, "myShopProductStock", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('variantId')),
    __param(2, (0, graphql_1.Args)('stockLocationId')),
    __param(3, (0, graphql_1.Args)('stockOnHand')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object, Number]),
    __metadata("design:returntype", Promise)
], InventoryMerchantResolver.prototype, "myShopStockAdjust", null);
exports.InventoryMerchantResolver = InventoryMerchantResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [inventory_service_1.InventoryService])
], InventoryMerchantResolver);
