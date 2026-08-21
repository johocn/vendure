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
exports.SettlementAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const settlement_service_1 = require("./settlement.service");
/** 平台管理端（ADMIN API）：全部商户账户/明细/提现审核/佣金配置。 */
let SettlementAdminResolver = class SettlementAdminResolver {
    constructor(settlementService) {
        this.settlementService = settlementService;
    }
    async merchantAccounts(ctx, options) {
        return this.settlementService.accounts(ctx, options);
    }
    async settlementEntriesByShop(ctx, shopId, options) {
        return this.settlementService.entriesByShop(ctx, shopId, options);
    }
    async withdrawalRequests(ctx, options) {
        return this.settlementService.allWithdrawalRequests(ctx, options);
    }
    async approveWithdrawal(ctx, id) {
        return this.settlementService.approveWithdrawal(ctx, id);
    }
    async payWithdrawal(ctx, id) {
        return this.settlementService.payWithdrawal(ctx, id);
    }
    async rejectWithdrawal(ctx, id, note) {
        return this.settlementService.rejectWithdrawal(ctx, id, note);
    }
    async setMerchantCommissionRate(ctx, shopId, rate) {
        return this.settlementService.setMerchantCommissionRate(ctx, shopId, rate);
    }
};
exports.SettlementAdminResolver = SettlementAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SettlementAdminResolver.prototype, "merchantAccounts", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('shopId')),
    __param(2, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], SettlementAdminResolver.prototype, "settlementEntriesByShop", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SettlementAdminResolver.prototype, "withdrawalRequests", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SettlementAdminResolver.prototype, "approveWithdrawal", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SettlementAdminResolver.prototype, "payWithdrawal", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('note', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], SettlementAdminResolver.prototype, "rejectWithdrawal", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('shopId')),
    __param(2, (0, graphql_1.Args)('rate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Number]),
    __metadata("design:returntype", Promise)
], SettlementAdminResolver.prototype, "setMerchantCommissionRate", null);
exports.SettlementAdminResolver = SettlementAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [settlement_service_1.SettlementService])
], SettlementAdminResolver);
//# sourceMappingURL=settlement-admin.resolver.js.map