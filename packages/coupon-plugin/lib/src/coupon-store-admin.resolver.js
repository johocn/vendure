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
exports.CouponStoreAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const coupon_store_service_1 = require("./coupon-store.service");
/**
 * 券 ↔ 门店（admin-api）：绑定维护 + 核销流水查询。
 * 权限对齐订单管理（Permission.UpdateOrder），渠道隔离在 service 内按 ctx.channelId 过滤。
 */
let CouponStoreAdminResolver = class CouponStoreAdminResolver {
    constructor(couponStoreService) {
        this.couponStoreService = couponStoreService;
    }
    async couponStoreBindings(ctx, templateId) {
        return this.couponStoreService.listBindings(ctx, templateId);
    }
    async setCouponStoreBindings(ctx, templateId, storeIds, coverage) {
        return this.couponStoreService.setBindings(ctx, templateId, storeIds, coverage !== null && coverage !== void 0 ? coverage : null);
    }
    async couponRedemptions(ctx, templateId, storeId, limit) {
        return this.couponStoreService.listRedemptions(ctx, templateId !== null && templateId !== void 0 ? templateId : null, storeId !== null && storeId !== void 0 ? storeId : null, limit !== null && limit !== void 0 ? limit : null);
    }
};
exports.CouponStoreAdminResolver = CouponStoreAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('templateId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponStoreAdminResolver.prototype, "couponStoreBindings", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('templateId')),
    __param(2, (0, graphql_1.Args)('storeIds')),
    __param(3, (0, graphql_1.Args)('coverage', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array, String]),
    __metadata("design:returntype", Promise)
], CouponStoreAdminResolver.prototype, "setCouponStoreBindings", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('templateId', { nullable: true })),
    __param(2, (0, graphql_1.Args)('storeId', { nullable: true })),
    __param(3, (0, graphql_1.Args)('limit', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object, Number]),
    __metadata("design:returntype", Promise)
], CouponStoreAdminResolver.prototype, "couponRedemptions", null);
exports.CouponStoreAdminResolver = CouponStoreAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [coupon_store_service_1.CouponStoreService])
], CouponStoreAdminResolver);
//# sourceMappingURL=coupon-store-admin.resolver.js.map