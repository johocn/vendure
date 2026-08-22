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
exports.DistributionAdminShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const commission_service_1 = require("./commission.service");
const distribution_service_1 = require("./distribution.service");
const withdrawal_service_1 = require("./withdrawal.service");
/**
 * 后台结算/打款操作（挂载到 shop-api，供 vshop 后台管理页使用）。
 * 权限由 @Allow 门控（SuperAdmin / 客户读改），模式照搬 marketplace shop.resolver。
 */
let DistributionAdminShopResolver = class DistributionAdminShopResolver {
    constructor(distributionService, commissionService, withdrawalService, customerService) {
        this.distributionService = distributionService;
        this.commissionService = commissionService;
        this.withdrawalService = withdrawalService;
        this.customerService = customerService;
    }
    async distributors(ctx, options) {
        const list = await this.distributionService.findAll(ctx, options);
        const items = await Promise.all(list.items.map(async (d) => {
            var _a;
            let customerEmail = null;
            if (d.customerId) {
                const customer = await this.customerService.findOne(ctx, d.customerId);
                customerEmail = (_a = customer === null || customer === void 0 ? void 0 : customer.emailAddress) !== null && _a !== void 0 ? _a : null;
            }
            return Object.assign(Object.assign({}, d), { customerEmail });
        }));
        return { items, totalItems: list.totalItems };
    }
    commissionRecords(ctx, options) {
        return this.commissionService.findAll(ctx, options);
    }
    withdrawalRequests(ctx, options) {
        return this.withdrawalService.findAll(ctx, options);
    }
    settleCommissionsNow(ctx) {
        return this.commissionService.settlePendingCommissions(ctx);
    }
    approveDistributor(ctx, id) {
        return this.distributionService.approve(ctx, id);
    }
    freezeDistributor(ctx, id) {
        return this.distributionService.freeze(ctx, id);
    }
    approveWithdrawal(ctx, id) {
        return this.withdrawalService.approve(ctx, id);
    }
    rejectWithdrawal(ctx, id) {
        return this.withdrawalService.reject(ctx, id);
    }
    markWithdrawalPaid(ctx, id) {
        return this.withdrawalService.markPaid(ctx, id);
    }
};
exports.DistributionAdminShopResolver = DistributionAdminShopResolver;
__decorate([
    (0, graphql_1.Query)('distributors'),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin, core_1.Permission.ReadCustomer),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DistributionAdminShopResolver.prototype, "distributors", null);
__decorate([
    (0, graphql_1.Query)('commissionRecords'),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin, core_1.Permission.ReadCustomer),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DistributionAdminShopResolver.prototype, "commissionRecords", null);
__decorate([
    (0, graphql_1.Query)('withdrawalRequests'),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin, core_1.Permission.ReadCustomer),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DistributionAdminShopResolver.prototype, "withdrawalRequests", null);
__decorate([
    (0, graphql_1.Mutation)('settleCommissionsNow'),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin, core_1.Permission.UpdateCustomer),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], DistributionAdminShopResolver.prototype, "settleCommissionsNow", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin, core_1.Permission.UpdateCustomer),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DistributionAdminShopResolver.prototype, "approveDistributor", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin, core_1.Permission.UpdateCustomer),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DistributionAdminShopResolver.prototype, "freezeDistributor", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin, core_1.Permission.UpdateCustomer),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DistributionAdminShopResolver.prototype, "approveWithdrawal", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin, core_1.Permission.UpdateCustomer),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DistributionAdminShopResolver.prototype, "rejectWithdrawal", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin, core_1.Permission.UpdateCustomer),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DistributionAdminShopResolver.prototype, "markWithdrawalPaid", null);
exports.DistributionAdminShopResolver = DistributionAdminShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [distribution_service_1.DistributionService,
        commission_service_1.CommissionService,
        withdrawal_service_1.WithdrawalService,
        core_1.CustomerService])
], DistributionAdminShopResolver);
//# sourceMappingURL=distribution-admin-shop.resolver.js.map