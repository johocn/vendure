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
exports.CouponFrFShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const coupon_frf_service_1 = require("./coupon-frf.service");
/**
 * FR-F：每日领券 / 神券日限量抢 C 端入口。
 * 活动视图匿名可查（未配置/未启用返回 null，前端不渲染）；
 * 领取需登录（未登录返回 NOT_LOGGED_IN，由前端引导）。
 */
let CouponFrFShopResolver = class CouponFrFShopResolver {
    constructor(frfService) {
        this.frfService = frfService;
    }
    async couponDailyClaimActivity(ctx) {
        return this.frfService.dailyClaimActivity(ctx);
    }
    claimDailyCoupon(ctx, templateId) {
        return this.frfService.claimDaily(ctx, Number(templateId));
    }
    async couponFlashSaleActivity(ctx) {
        return this.frfService.flashSaleActivity(ctx);
    }
    claimFlashCoupon(ctx, templateId) {
        return this.frfService.claimFlash(ctx, Number(templateId));
    }
};
exports.CouponFrFShopResolver = CouponFrFShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], CouponFrFShopResolver.prototype, "couponDailyClaimActivity", null);
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('templateId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponFrFShopResolver.prototype, "claimDailyCoupon", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], CouponFrFShopResolver.prototype, "couponFlashSaleActivity", null);
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('templateId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponFrFShopResolver.prototype, "claimFlashCoupon", null);
exports.CouponFrFShopResolver = CouponFrFShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [coupon_frf_service_1.CouponFrFService])
], CouponFrFShopResolver);
//# sourceMappingURL=coupon-frf-shop.resolver.js.map