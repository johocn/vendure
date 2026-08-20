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
exports.CouponShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const coupon_service_1 = require("./coupon.service");
let CouponShopResolver = class CouponShopResolver {
    constructor(couponService, orderService) {
        this.couponService = couponService;
        this.orderService = orderService;
    }
    async couponCentre(ctx) {
        return this.couponService.couponCentre(ctx);
    }
    async myCoupons(ctx, status) {
        return this.couponService.listMyCoupons(ctx, status);
    }
    async claimCoupon(ctx, templateId) {
        return this.couponService.claimCoupon(ctx, templateId);
    }
    async applyCouponToOrder(ctx, code) {
        const order = await this.orderService.getActiveOrderForUser(ctx, ctx.activeUserId);
        if (!order) {
            throw new core_1.UserInputError('No active order to apply coupon');
        }
        return this.couponService.applyCouponToOrder(ctx, order.id, code);
    }
    async clearCouponFromOrder(ctx) {
        const order = await this.orderService.getActiveOrderForUser(ctx, ctx.activeUserId);
        if (!order) {
            throw new core_1.UserInputError('No active order to clear coupon');
        }
        return this.couponService.clearCouponFromOrder(ctx, order.id);
    }
};
exports.CouponShopResolver = CouponShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], CouponShopResolver.prototype, "couponCentre", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], CouponShopResolver.prototype, "myCoupons", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('templateId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponShopResolver.prototype, "claimCoupon", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], CouponShopResolver.prototype, "applyCouponToOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], CouponShopResolver.prototype, "clearCouponFromOrder", null);
exports.CouponShopResolver = CouponShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [coupon_service_1.CouponService,
        core_1.OrderService])
], CouponShopResolver);
//# sourceMappingURL=coupon-shop.resolver.js.map