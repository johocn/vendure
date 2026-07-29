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
exports.CouponAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const coupon_entity_1 = require("./coupon.entity");
const coupon_service_1 = require("./coupon.service");
let CouponAdminResolver = class CouponAdminResolver {
    constructor(couponService) {
        this.couponService = couponService;
    }
    async enabledInCurrentChannel(ctx, coupon) {
        // 如果是租户自建券，总是返回 true（自己渠道的券自然是启用的）
        if (!coupon.isGlobal)
            return true;
        // 全局券：检查 channels 关系中是否包含当前渠道
        const full = await this.couponService.getCoupon(ctx, coupon.id);
        if (!full || !full.channels)
            return false;
        return full.channels.some(ch => ch.id === ctx.channelId);
    }
    async coupons(ctx, options) {
        return this.couponService.getCoupons(ctx, options);
    }
    async coupon(ctx, id) {
        return this.couponService.getCoupon(ctx, id);
    }
    async createCoupon(ctx, input) {
        return this.couponService.createCoupon(ctx, input);
    }
    async updateCoupon(ctx, id, input) {
        return this.couponService.updateCoupon(ctx, id, input);
    }
    async deleteCoupon(ctx, id) {
        return this.couponService.deleteCoupon(ctx, id);
    }
    async enableCouponForChannel(ctx, id) {
        return this.couponService.enableCouponForChannel(ctx, id);
    }
    async disableCouponForChannel(ctx, id) {
        return this.couponService.disableCouponForChannel(ctx, id);
    }
};
exports.CouponAdminResolver = CouponAdminResolver;
__decorate([
    (0, graphql_1.ResolveField)('enabledInCurrentChannel', () => Boolean),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext,
        coupon_entity_1.Coupon]),
    __metadata("design:returntype", Promise)
], CouponAdminResolver.prototype, "enabledInCurrentChannel", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponAdminResolver.prototype, "coupons", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponAdminResolver.prototype, "coupon", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponAdminResolver.prototype, "createCoupon", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], CouponAdminResolver.prototype, "updateCoupon", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponAdminResolver.prototype, "deleteCoupon", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponAdminResolver.prototype, "enableCouponForChannel", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponAdminResolver.prototype, "disableCouponForChannel", null);
exports.CouponAdminResolver = CouponAdminResolver = __decorate([
    (0, graphql_1.Resolver)(() => coupon_entity_1.Coupon),
    __metadata("design:paramtypes", [coupon_service_1.CouponService])
], CouponAdminResolver);
//# sourceMappingURL=coupon-admin.resolver.js.map