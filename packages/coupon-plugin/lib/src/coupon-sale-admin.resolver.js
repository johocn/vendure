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
exports.CouponSaleAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const coupon_sale_service_1 = require("./coupon-sale.service");
/**
 * 券商城后台（admin-api）：券包 CRUD、出售单流水查询与退款。
 * 权限对齐订单管理（Permission.UpdateOrder），渠道隔离在 service 内按 ctx.channelId 过滤。
 */
let CouponSaleAdminResolver = class CouponSaleAdminResolver {
    constructor(couponSaleService) {
        this.couponSaleService = couponSaleService;
    }
    async couponBundles(ctx, options) {
        var _a, _b;
        return this.couponSaleService.listBundles(ctx, {
            skip: (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0,
            take: (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 20,
        });
    }
    async couponBundle(ctx, id) {
        return this.couponSaleService.findBundle(ctx, id);
    }
    async couponSaleOrders(ctx, options) {
        var _a, _b, _c;
        return this.couponSaleService.listSaleOrders(ctx, {
            skip: (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0,
            take: (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 20,
            status: (_c = options === null || options === void 0 ? void 0 : options.status) !== null && _c !== void 0 ? _c : undefined,
        });
    }
    async couponSaleOrder(ctx, id) {
        return this.couponSaleService.findSaleOrder(ctx, id);
    }
    async createCouponBundle(ctx, input) {
        return this.couponSaleService.saveBundle(ctx, input);
    }
    async updateCouponBundle(ctx, id, input) {
        return this.couponSaleService.saveBundle(ctx, input, id);
    }
    async deleteCouponBundle(ctx, id) {
        return this.couponSaleService.deleteBundle(ctx, id);
    }
    async refundCouponSaleOrder(ctx, id, reason) {
        return this.couponSaleService.refundSaleOrder(ctx, id, reason);
    }
};
exports.CouponSaleAdminResolver = CouponSaleAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponSaleAdminResolver.prototype, "couponBundles", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponSaleAdminResolver.prototype, "couponBundle", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponSaleAdminResolver.prototype, "couponSaleOrders", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponSaleAdminResolver.prototype, "couponSaleOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponSaleAdminResolver.prototype, "createCouponBundle", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], CouponSaleAdminResolver.prototype, "updateCouponBundle", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponSaleAdminResolver.prototype, "deleteCouponBundle", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('reason', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], CouponSaleAdminResolver.prototype, "refundCouponSaleOrder", null);
exports.CouponSaleAdminResolver = CouponSaleAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [coupon_sale_service_1.CouponSaleService])
], CouponSaleAdminResolver);
//# sourceMappingURL=coupon-sale-admin.resolver.js.map