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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponMarketingService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const coupon_plugin_1 = require("@vendure/coupon-plugin");
const constants_1 = require("../constants");
let CouponMarketingService = class CouponMarketingService {
    constructor(couponService) {
        this.couponService = couponService;
    }
    assertPermission(ctx) {
        if (!ctx.userHasPermissions([constants_1.OperationsPermissions.ManageCoupon])) {
            throw new core_1.ForbiddenError();
        }
    }
    async findAll(ctx, options) {
        this.assertPermission(ctx);
        return this.couponService.getCoupons(ctx, options);
    }
    async findOne(ctx, id) {
        this.assertPermission(ctx);
        return this.couponService.getCoupon(ctx, id);
    }
    async create(ctx, input) {
        this.assertPermission(ctx);
        return this.couponService.createCoupon(ctx, input);
    }
    async update(ctx, id, input) {
        this.assertPermission(ctx);
        return this.couponService.updateCoupon(ctx, id, input);
    }
    async delete(ctx, id) {
        this.assertPermission(ctx);
        return this.couponService.deleteCoupon(ctx, id);
    }
    async enableForChannel(ctx, id) {
        this.assertPermission(ctx);
        return this.couponService.enableCouponForChannel(ctx, id);
    }
    async disableForChannel(ctx, id) {
        this.assertPermission(ctx);
        return this.couponService.disableCouponForChannel(ctx, id);
    }
};
exports.CouponMarketingService = CouponMarketingService;
exports.CouponMarketingService = CouponMarketingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [coupon_plugin_1.CouponService])
], CouponMarketingService);
