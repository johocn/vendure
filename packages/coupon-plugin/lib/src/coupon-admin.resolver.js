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
const shop_plugin_1 = require("@vendure/shop-plugin");
const coupon_service_1 = require("./coupon.service");
/**
 * 优惠券 admin 接口：平台管理员（UpdateOrder）与店主管理员（ManageOwnShop）共用同一 GraphQL 面。
 * `@Allow` 为 OR 语义（任一权限命中即放行），店主须能进入本 resolver，属店隔离再由
 * service 层 resolveShopIdFromActiveUser / assertManagedByShop 与列表过滤兜底；
 * 否则店主在权限闸门即被拒，service 内的隔离逻辑对店主不可达。
 */
let CouponAdminResolver = class CouponAdminResolver {
    constructor(couponService) {
        this.couponService = couponService;
    }
    async couponTemplates(ctx, options) {
        return this.couponService.findAllTemplates(ctx, options);
    }
    async couponTemplate(ctx, id) {
        return this.couponService.findOneTemplate(ctx, id);
    }
    async customerCoupons(ctx, options) {
        return this.couponService.listAllCoupons(ctx, options);
    }
    async createCouponTemplate(ctx, input) {
        return this.couponService.createTemplate(ctx, input);
    }
    async updateCouponTemplate(ctx, input) {
        return this.couponService.updateTemplate(ctx, input);
    }
    async deleteCouponTemplate(ctx, id) {
        await this.couponService.deleteTemplate(ctx, id);
        return true;
    }
    async grantCoupon(ctx, templateId, customerIds) {
        return this.couponService.grantCoupon(ctx, templateId, customerIds);
    }
    async revokeCustomerCoupon(ctx, id) {
        return this.couponService.revokeCoupon(ctx, id);
    }
    async couponChannelCustomers(ctx, query, take, skip) {
        return this.couponService.listChannelCustomers(ctx, query !== null && query !== void 0 ? query : undefined, take !== null && take !== void 0 ? take : 20, skip !== null && skip !== void 0 ? skip : 0);
    }
    async grantCouponIssue(ctx, templateId, customerIds, notify) {
        return this.couponService.grantCouponIssue(ctx, templateId, customerIds, notify);
    }
};
exports.CouponAdminResolver = CouponAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder, shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponAdminResolver.prototype, "couponTemplates", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder, shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponAdminResolver.prototype, "couponTemplate", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder, shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponAdminResolver.prototype, "customerCoupons", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder, shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponAdminResolver.prototype, "createCouponTemplate", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder, shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponAdminResolver.prototype, "updateCouponTemplate", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder, shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponAdminResolver.prototype, "deleteCouponTemplate", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder, shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('templateId')),
    __param(2, (0, graphql_1.Args)('customerIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array]),
    __metadata("design:returntype", Promise)
], CouponAdminResolver.prototype, "grantCoupon", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder, shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponAdminResolver.prototype, "revokeCustomerCoupon", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder, shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('query', { nullable: true })),
    __param(2, (0, graphql_1.Args)('take', { nullable: true, type: () => Number })),
    __param(3, (0, graphql_1.Args)('skip', { nullable: true, type: () => Number })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Number, Number]),
    __metadata("design:returntype", Promise)
], CouponAdminResolver.prototype, "couponChannelCustomers", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder, shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('templateId')),
    __param(2, (0, graphql_1.Args)('customerIds', { type: () => [String] })),
    __param(3, (0, graphql_1.Args)('notify')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array, Boolean]),
    __metadata("design:returntype", Promise)
], CouponAdminResolver.prototype, "grantCouponIssue", null);
exports.CouponAdminResolver = CouponAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [coupon_service_1.CouponService])
], CouponAdminResolver);
//# sourceMappingURL=coupon-admin.resolver.js.map