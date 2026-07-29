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
        const coupon = await this.couponService.getCoupon(ctx, id);
        if (!coupon)
            throw new core_1.EntityNotFoundError('Coupon', id);
        let result;
        if (coupon.isGlobal) {
            result = await this.couponService.enableCouponForChannel(ctx, id);
        }
        else if (!coupon.isActive) {
            // 非全局券：通过 isActive 启停
            result = await this.couponService.updateCoupon(ctx, id, { isActive: true });
        }
        else {
            result = coupon;
        }
        return this.attachEnabledInCurrentChannel(ctx, result);
    }
    async disableForChannel(ctx, id) {
        this.assertPermission(ctx);
        const coupon = await this.couponService.getCoupon(ctx, id);
        if (!coupon)
            throw new core_1.EntityNotFoundError('Coupon', id);
        let result;
        if (coupon.isGlobal) {
            result = await this.couponService.disableCouponForChannel(ctx, id);
        }
        else {
            // 非全局券：通过 isActive 启停
            result = await this.couponService.updateCoupon(ctx, id, { isActive: false });
        }
        return this.attachEnabledInCurrentChannel(ctx, result);
    }
    /**
     * MarketingCoupon schema 类型没有 enabledInCurrentChannel 字段解析器，
     * 需在 service 层计算并附加到返回对象上，供 GraphQL 直接读取。
     */
    attachEnabledInCurrentChannel(ctx, coupon) {
        var _a;
        if (!coupon)
            return coupon;
        if (!coupon.isGlobal) {
            coupon.enabledInCurrentChannel = true;
        }
        else {
            coupon.enabledInCurrentChannel = !!((_a = coupon.channels) === null || _a === void 0 ? void 0 : _a.some((ch) => ch.id === ctx.channelId));
        }
        return coupon;
    }
};
exports.CouponMarketingService = CouponMarketingService;
exports.CouponMarketingService = CouponMarketingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [coupon_plugin_1.CouponService])
], CouponMarketingService);
