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
exports.DistributionShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const commission_service_1 = require("./commission.service");
const distribution_service_1 = require("./distribution.service");
const withdrawal_service_1 = require("./withdrawal.service");
let DistributionShopResolver = class DistributionShopResolver {
    constructor(distributionService, commissionService, withdrawalService, customerService) {
        this.distributionService = distributionService;
        this.commissionService = commissionService;
        this.withdrawalService = withdrawalService;
        this.customerService = customerService;
    }
    /**
     * shop-api 会话的 ctx.activeUserId 是 User 的 id，而 Distributor.customerId 存的是 Customer 的 id，
     * 二者数字空间重叠会错配。统一经 findOneByUserId 解析出真实 customer id。
     */
    async resolveCustomerId(ctx) {
        if (!ctx.activeUserId)
            return undefined;
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        return customer === null || customer === void 0 ? void 0 : customer.id;
    }
    async myDistributorProfile(ctx) {
        const customerId = await this.resolveCustomerId(ctx);
        if (!customerId)
            return undefined;
        return this.distributionService.findByCustomerId(ctx, customerId);
    }
    async myCommissionRecords(ctx, options) {
        const customerId = await this.resolveCustomerId(ctx);
        if (!customerId)
            return { items: [], totalItems: 0 };
        const distributor = await this.distributionService.findByCustomerId(ctx, customerId);
        if (!distributor)
            return { items: [], totalItems: 0 };
        return this.commissionService.findByDistributor(ctx, distributor.id, options);
    }
    async myWithdrawalRequests(ctx, options) {
        const customerId = await this.resolveCustomerId(ctx);
        if (!customerId)
            return { items: [], totalItems: 0 };
        const distributor = await this.distributionService.findByCustomerId(ctx, customerId);
        if (!distributor)
            return { items: [], totalItems: 0 };
        return this.withdrawalService.findByDistributor(ctx, distributor.id, options);
    }
    async myTeamSummary(ctx) {
        const customerId = await this.resolveCustomerId(ctx);
        if (!customerId) {
            return { directTeamSize: 0, indirectTeamSize: 0, totalTeamSize: 0, orderCount: 0, orderAmount: 0, teamCommission: 0 };
        }
        const distributor = await this.distributionService.findByCustomerId(ctx, customerId);
        if (!distributor) {
            return { directTeamSize: 0, indirectTeamSize: 0, totalTeamSize: 0, orderCount: 0, orderAmount: 0, teamCommission: 0 };
        }
        return this.distributionService.getTeamSummary(ctx, distributor.id);
    }
    async applyDistributor(ctx, referredByCode) {
        const customerId = await this.resolveCustomerId(ctx);
        if (!customerId) {
            throw new Error('Must be logged in to apply as distributor');
        }
        return this.distributionService.apply(ctx, customerId, referredByCode !== null && referredByCode !== void 0 ? referredByCode : undefined);
    }
    async requestWithdrawal(ctx, amount, method, accountInfo) {
        const customerId = await this.resolveCustomerId(ctx);
        if (!customerId) {
            throw new Error('Must be logged in to request withdrawal');
        }
        const distributor = await this.distributionService.findByCustomerId(ctx, customerId);
        if (!distributor) {
            throw new Error('Not a distributor');
        }
        return this.withdrawalService.request(ctx, distributor.id, amount, method, accountInfo);
    }
};
exports.DistributionShopResolver = DistributionShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], DistributionShopResolver.prototype, "myDistributorProfile", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DistributionShopResolver.prototype, "myCommissionRecords", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DistributionShopResolver.prototype, "myWithdrawalRequests", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], DistributionShopResolver.prototype, "myTeamSummary", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('referredByCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], DistributionShopResolver.prototype, "applyDistributor", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('amount')),
    __param(2, (0, graphql_1.Args)('method')),
    __param(3, (0, graphql_1.Args)('accountInfo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, String, String]),
    __metadata("design:returntype", Promise)
], DistributionShopResolver.prototype, "requestWithdrawal", null);
exports.DistributionShopResolver = DistributionShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [distribution_service_1.DistributionService,
        commission_service_1.CommissionService,
        withdrawal_service_1.WithdrawalService,
        core_1.CustomerService])
], DistributionShopResolver);
//# sourceMappingURL=distribution-shop.resolver.js.map