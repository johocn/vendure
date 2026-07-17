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
const coupon_code_entity_1 = require("./coupon-code.entity");
const coupon_entity_1 = require("./coupon.entity");
const coupon_service_1 = require("./coupon.service");
let CouponShopResolver = class CouponShopResolver {
    constructor(couponService) {
        this.couponService = couponService;
    }
    async coupon(ctx, couponCode) {
        return this.couponService.getCoupon(ctx, couponCode.couponId);
    }
    async availableCoupons(ctx) {
        return this.couponService.getAvailableCoupons(ctx);
    }
    async myCoupons(ctx, status) {
        return this.couponService.getMyCoupons(ctx, status);
    }
    async validateCoupon(ctx, code, orderId) {
        if (!orderId) {
            return { valid: true, discountAmount: 0, error: null };
        }
        const orderLines = await this.couponService.getOrderLinesForCoupon(ctx, orderId);
        return this.couponService.validateCoupon(ctx, code, orderLines);
    }
    async claimCoupon(ctx, couponId) {
        return this.couponService.claimCoupon(ctx, couponId);
    }
    async redeemCoupon(ctx, code, orderId) {
        return this.couponService.redeemCoupon(ctx, code, orderId);
    }
    /**
     * 绑定券码到订单（Promotion 桥接入口）。
     * 设置 order.customFields.appliedCouponCode，由 couponOrderAction 自动计算折扣。
     * 不立即核销——核销由 OrderPlacedEvent 触发。
     */
    async applyCoupon(ctx, orderId, code) {
        return this.couponService.applyCouponToOrder(ctx, orderId, code);
    }
};
exports.CouponShopResolver = CouponShopResolver;
__decorate([
    (0, graphql_1.ResolveField)('coupon', () => coupon_entity_1.Coupon),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext,
        coupon_code_entity_1.CouponCode]),
    __metadata("design:returntype", Promise)
], CouponShopResolver.prototype, "coupon", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], CouponShopResolver.prototype, "availableCoupons", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('status', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], CouponShopResolver.prototype, "myCoupons", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('code')),
    __param(2, (0, graphql_1.Args)('orderId', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Object]),
    __metadata("design:returntype", Promise)
], CouponShopResolver.prototype, "validateCoupon", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('couponId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponShopResolver.prototype, "claimCoupon", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('code')),
    __param(2, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Object]),
    __metadata("design:returntype", Promise)
], CouponShopResolver.prototype, "redeemCoupon", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], CouponShopResolver.prototype, "applyCoupon", null);
exports.CouponShopResolver = CouponShopResolver = __decorate([
    (0, graphql_1.Resolver)(() => coupon_code_entity_1.CouponCode),
    __metadata("design:paramtypes", [coupon_service_1.CouponService])
], CouponShopResolver);
//# sourceMappingURL=coupon-shop.resolver.js.map