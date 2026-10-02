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
exports.CouponSaleShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const coupon_sale_service_1 = require("./coupon-sale.service");
/**
 * 券商城（shop-api）：可售目录、出售单购买（微信 / 余额）、我的出售单，
 * 以及商品页加价购的挂载 / 摘除。全部要求登录（Permission.Authenticated），
 * 归属校验（本人 / 本渠道）在 CouponSaleService 内完成。
 */
let CouponSaleShopResolver = class CouponSaleShopResolver {
    constructor(couponSaleService, orderService) {
        this.couponSaleService = couponSaleService;
        this.orderService = orderService;
    }
    async couponSaleCatalogue(ctx, scene) {
        return this.couponSaleService.saleCatalogue(ctx, scene !== null && scene !== void 0 ? scene : undefined);
    }
    async myCouponSaleOrders(ctx) {
        return this.couponSaleService.mySaleOrders(ctx);
    }
    async createCouponSaleOrder(ctx, templateId, bundleId) {
        return this.couponSaleService.createSaleOrder(ctx, templateId !== null && templateId !== void 0 ? templateId : null, bundleId !== null && bundleId !== void 0 ? bundleId : null);
    }
    async payCouponSaleWithBalance(ctx, id) {
        return this.couponSaleService.paySaleOrderWithBalance(ctx, id);
    }
    async createWechatCouponPayment(ctx, saleOrderId, tradeType, openid) {
        const tt = (tradeType !== null && tradeType !== void 0 ? tradeType : 'JSAPI');
        return this.couponSaleService.createWechatCouponPayment(ctx, saleOrderId, tt, openid);
    }
    async cancelCouponSaleOrder(ctx, id) {
        return this.couponSaleService.cancelSaleOrder(ctx, id);
    }
    async refundCouponSaleOrder(ctx, id, reason) {
        return this.couponSaleService.refundSaleOrder(ctx, id, reason);
    }
    async attachCouponToOrder(ctx, orderId, templateId) {
        return this.couponSaleService.attachCouponToOrder(ctx, orderId, templateId, this.orderService);
    }
    async detachCouponFromOrder(ctx, orderId, templateId) {
        return this.couponSaleService.detachCouponFromOrder(ctx, orderId, templateId, this.orderService);
    }
};
exports.CouponSaleShopResolver = CouponSaleShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('scene', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], CouponSaleShopResolver.prototype, "couponSaleCatalogue", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], CouponSaleShopResolver.prototype, "myCouponSaleOrders", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('templateId', { nullable: true })),
    __param(2, (0, graphql_1.Args)('bundleId', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], CouponSaleShopResolver.prototype, "createCouponSaleOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponSaleShopResolver.prototype, "payCouponSaleWithBalance", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('saleOrderId')),
    __param(2, (0, graphql_1.Args)('tradeType', { nullable: true })),
    __param(3, (0, graphql_1.Args)('openid', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String, String]),
    __metadata("design:returntype", Promise)
], CouponSaleShopResolver.prototype, "createWechatCouponPayment", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CouponSaleShopResolver.prototype, "cancelCouponSaleOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('reason', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], CouponSaleShopResolver.prototype, "refundCouponSaleOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('templateId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], CouponSaleShopResolver.prototype, "attachCouponToOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('templateId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], CouponSaleShopResolver.prototype, "detachCouponFromOrder", null);
exports.CouponSaleShopResolver = CouponSaleShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [coupon_sale_service_1.CouponSaleService,
        core_1.OrderService])
], CouponSaleShopResolver);
//# sourceMappingURL=coupon-sale-shop.resolver.js.map