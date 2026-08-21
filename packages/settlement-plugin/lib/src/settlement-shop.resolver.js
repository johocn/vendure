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
exports.SettlementShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const shop_plugin_1 = require("@vendure/shop-plugin");
const settlement_service_1 = require("./settlement.service");
/** 店主自营后台（ADMIN API）：财务对账 + 提现。归属隔离由 service 按 Shop.administratorId。 */
let SettlementShopResolver = class SettlementShopResolver {
    constructor(settlementService) {
        this.settlementService = settlementService;
    }
    async myMerchantAccount(ctx) {
        return this.settlementService.myAccount(ctx);
    }
    async mySettlementEntries(ctx, options) {
        return this.settlementService.mySettlementEntries(ctx, options);
    }
    async myWithdrawalRequests(ctx, options) {
        return this.settlementService.myWithdrawalRequests(ctx, options);
    }
    async mySettlementSummary(ctx, from, to) {
        return this.settlementService.mySettlementSummary(ctx, from, to);
    }
    async requestWithdrawal(ctx, amount) {
        return this.settlementService.requestWithdrawal(ctx, amount);
    }
};
exports.SettlementShopResolver = SettlementShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], SettlementShopResolver.prototype, "myMerchantAccount", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SettlementShopResolver.prototype, "mySettlementEntries", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SettlementShopResolver.prototype, "myWithdrawalRequests", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('from', { nullable: true })),
    __param(2, (0, graphql_1.Args)('to', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext,
        Date,
        Date]),
    __metadata("design:returntype", Promise)
], SettlementShopResolver.prototype, "mySettlementSummary", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('amount')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number]),
    __metadata("design:returntype", Promise)
], SettlementShopResolver.prototype, "requestWithdrawal", null);
exports.SettlementShopResolver = SettlementShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [settlement_service_1.SettlementService])
], SettlementShopResolver);
//# sourceMappingURL=settlement-shop.resolver.js.map