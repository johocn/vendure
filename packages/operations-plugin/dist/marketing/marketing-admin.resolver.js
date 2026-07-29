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
exports.MarketingAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
const coupon_service_1 = require("./coupon.service");
const flash_sale_service_1 = require("./flash-sale.service");
const group_buy_service_1 = require("./group-buy.service");
const marketing_overview_service_1 = require("./marketing-overview.service");
/**
 * Marketing admin resolver. Field names are prefixed with `marketing` where they
 * would otherwise collide with the dedicated FlashSale/GroupBuy/Coupon plugins
 * (which also contribute to the admin API schema).
 */
let MarketingAdminResolver = class MarketingAdminResolver {
    constructor(flashSaleMarketingService, groupBuyMarketingService, couponMarketingService, marketingOverviewService) {
        this.flashSaleMarketingService = flashSaleMarketingService;
        this.groupBuyMarketingService = groupBuyMarketingService;
        this.couponMarketingService = couponMarketingService;
        this.marketingOverviewService = marketingOverviewService;
    }
    // ===== Overview =====
    async marketingOverview(ctx) {
        return this.marketingOverviewService.getOverview(ctx);
    }
    // ===== FlashSale (prefixed to avoid clash with FlashSalePlugin) =====
    async marketingFlashSaleActivities(ctx, options) {
        return this.flashSaleMarketingService.findAll(ctx, options);
    }
    async marketingFlashSaleActivity(ctx, id) {
        return this.flashSaleMarketingService.findOne(ctx, id);
    }
    async createFlashSale(ctx, input) {
        return this.flashSaleMarketingService.create(ctx, input);
    }
    async updateFlashSale(ctx, input) {
        return this.flashSaleMarketingService.update(ctx, input);
    }
    async deleteFlashSale(ctx, id) {
        return this.flashSaleMarketingService.delete(ctx, id);
    }
    // ===== GroupBuy (prefixed to avoid clash with GroupBuyPlugin) =====
    async marketingGroupBuyActivities(ctx, options) {
        return this.groupBuyMarketingService.findAll(ctx, options);
    }
    async marketingGroupBuyActivity(ctx, id) {
        return this.groupBuyMarketingService.findOne(ctx, id);
    }
    async createGroupBuy(ctx, input) {
        return this.groupBuyMarketingService.create(ctx, input);
    }
    async updateGroupBuy(ctx, input) {
        return this.groupBuyMarketingService.update(ctx, input);
    }
    async deleteGroupBuy(ctx, id) {
        return this.groupBuyMarketingService.delete(ctx, id);
    }
    // ===== Coupon (prefixed to avoid clash with CouponPlugin) =====
    async marketingCoupons(ctx, options) {
        return this.couponMarketingService.findAll(ctx, options);
    }
    async marketingCoupon(ctx, id) {
        return this.couponMarketingService.findOne(ctx, id);
    }
    async marketingCreateCoupon(ctx, input) {
        return this.couponMarketingService.create(ctx, input);
    }
    async marketingUpdateCoupon(ctx, id, input) {
        return this.couponMarketingService.update(ctx, id, input);
    }
    async marketingDeleteCoupon(ctx, id) {
        return this.couponMarketingService.delete(ctx, id);
    }
    async marketingEnableCouponForChannel(ctx, id) {
        return this.couponMarketingService.enableForChannel(ctx, id);
    }
    async marketingDisableCouponForChannel(ctx, id) {
        return this.couponMarketingService.disableForChannel(ctx, id);
    }
};
exports.MarketingAdminResolver = MarketingAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.OperationsPermissions.ManagePromotion),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], MarketingAdminResolver.prototype, "marketingOverview", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MarketingAdminResolver.prototype, "marketingFlashSaleActivities", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MarketingAdminResolver.prototype, "marketingFlashSaleActivity", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MarketingAdminResolver.prototype, "createFlashSale", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MarketingAdminResolver.prototype, "updateFlashSale", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MarketingAdminResolver.prototype, "deleteFlashSale", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MarketingAdminResolver.prototype, "marketingGroupBuyActivities", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MarketingAdminResolver.prototype, "marketingGroupBuyActivity", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MarketingAdminResolver.prototype, "createGroupBuy", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MarketingAdminResolver.prototype, "updateGroupBuy", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MarketingAdminResolver.prototype, "deleteGroupBuy", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MarketingAdminResolver.prototype, "marketingCoupons", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MarketingAdminResolver.prototype, "marketingCoupon", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MarketingAdminResolver.prototype, "marketingCreateCoupon", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], MarketingAdminResolver.prototype, "marketingUpdateCoupon", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MarketingAdminResolver.prototype, "marketingDeleteCoupon", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MarketingAdminResolver.prototype, "marketingEnableCouponForChannel", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MarketingAdminResolver.prototype, "marketingDisableCouponForChannel", null);
exports.MarketingAdminResolver = MarketingAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [flash_sale_service_1.FlashSaleMarketingService,
        group_buy_service_1.GroupBuyMarketingService,
        coupon_service_1.CouponMarketingService,
        marketing_overview_service_1.MarketingOverviewService])
], MarketingAdminResolver);
