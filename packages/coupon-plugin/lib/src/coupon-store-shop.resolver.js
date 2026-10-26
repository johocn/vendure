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
exports.CouponStoreShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const coupon_store_service_1 = require("./coupon-store.service");
/**
 * 券 ↔ 门店（shop-api）：
 * - couponTemplateStores：券模板可用门店（无绑定 = 附近全部门店，历史券不变）
 * - couponStoresForCoupon：按券码查本人券的可用门店
 * - redeemCouponAtStore：到店核销（需登录，本人券）
 */
let CouponStoreShopResolver = class CouponStoreShopResolver {
    constructor(couponStoreService) {
        this.couponStoreService = couponStoreService;
    }
    async couponTemplateStores(ctx, templateId, lat, lng) {
        return this.couponStoreService.templateStores(ctx, templateId, lat !== null && lat !== void 0 ? lat : null, lng !== null && lng !== void 0 ? lng : null);
    }
    async couponStoresForCoupon(ctx, code, lat, lng) {
        return this.couponStoreService.storesForCoupon(ctx, code, lat !== null && lat !== void 0 ? lat : null, lng !== null && lng !== void 0 ? lng : null);
    }
    async redeemCouponAtStore(ctx, couponCode, storeId) {
        if (!ctx.activeUserId) {
            throw new core_1.UserInputError('Please sign in to redeem the coupon');
        }
        return this.couponStoreService.redeemAtStore(ctx, couponCode, storeId);
    }
};
exports.CouponStoreShopResolver = CouponStoreShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('templateId')),
    __param(2, (0, graphql_1.Args)('lat', { nullable: true })),
    __param(3, (0, graphql_1.Args)('lng', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Number, Number]),
    __metadata("design:returntype", Promise)
], CouponStoreShopResolver.prototype, "couponTemplateStores", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('code')),
    __param(2, (0, graphql_1.Args)('lat', { nullable: true })),
    __param(3, (0, graphql_1.Args)('lng', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Number, Number]),
    __metadata("design:returntype", Promise)
], CouponStoreShopResolver.prototype, "couponStoresForCoupon", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('couponCode')),
    __param(2, (0, graphql_1.Args)('storeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Object]),
    __metadata("design:returntype", Promise)
], CouponStoreShopResolver.prototype, "redeemCouponAtStore", null);
exports.CouponStoreShopResolver = CouponStoreShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [coupon_store_service_1.CouponStoreService])
], CouponStoreShopResolver);
//# sourceMappingURL=coupon-store-shop.resolver.js.map