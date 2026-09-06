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
exports.CustomerCouponResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const coupon_service_1 = require("./coupon.service");
/**
 * CustomerCoupon.template 关系字段解析。
 * claimCoupon / grantCouponIssue 返回的实例未预加载 template 关联，
 * 若无字段解析器则 GraphQL 输出 template:null。此处按 templateId 补查并复用
 * findOneTemplate（顺带应用本地化与属店隔离，shop 会话下 adminShopId 为 undefined 不拦截）。
 */
let CustomerCouponResolver = class CustomerCouponResolver {
    constructor(couponService) {
        this.couponService = couponService;
    }
    async template(cc, ctx) {
        if (cc.template)
            return cc.template;
        if (cc.templateId == null)
            return null;
        return this.couponService.findOneTemplate(ctx, cc.templateId);
    }
};
exports.CustomerCouponResolver = CustomerCouponResolver;
__decorate([
    (0, graphql_1.ResolveField)('template'),
    __param(0, (0, graphql_1.Parent)()),
    __param(1, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], CustomerCouponResolver.prototype, "template", null);
exports.CustomerCouponResolver = CustomerCouponResolver = __decorate([
    (0, graphql_1.Resolver)('CustomerCoupon'),
    __metadata("design:paramtypes", [coupon_service_1.CouponService])
], CustomerCouponResolver);
//# sourceMappingURL=coupon-customer-coupon.resolver.js.map