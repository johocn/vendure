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
exports.CouponFissionShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const coupon_fission_service_1 = require("./coupon-fission.service");
/** FR-C 分享裂变：C 端活动视图 + 领奖入口（匿名可看活动，领奖需登录——未登录返回 NOT_LOGGED_IN 由前端引导）。 */
let CouponFissionShopResolver = class CouponFissionShopResolver {
    constructor(fissionService) {
        this.fissionService = fissionService;
    }
    async couponFissionActivity(ctx) {
        return this.fissionService.fissionActivity(ctx);
    }
    claimFissionReward(ctx, inviteCode) {
        return this.fissionService.claimReward(ctx, inviteCode);
    }
};
exports.CouponFissionShopResolver = CouponFissionShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], CouponFissionShopResolver.prototype, "couponFissionActivity", null);
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('inviteCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], CouponFissionShopResolver.prototype, "claimFissionReward", null);
exports.CouponFissionShopResolver = CouponFissionShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [coupon_fission_service_1.CouponFissionService])
], CouponFissionShopResolver);
//# sourceMappingURL=coupon-fission-shop.resolver.js.map