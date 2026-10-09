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
exports.BalanceWithdrawalAdminResolver = exports.BalanceWithdrawalShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const balance_withdrawal_service_1 = require("./balance-withdrawal.service");
let BalanceWithdrawalShopResolver = class BalanceWithdrawalShopResolver {
    constructor(balanceWithdrawalService) {
        this.balanceWithdrawalService = balanceWithdrawalService;
    }
    async myBalanceWithFrozen(ctx) {
        return this.balanceWithdrawalService.myBalance(ctx);
    }
    async myBalanceWithdrawals(ctx, options) {
        return this.balanceWithdrawalService.findMyRequests(ctx, options);
    }
    async requestBalanceWithdrawal(ctx, amount, method, accountInfo) {
        return this.balanceWithdrawalService.request(ctx, amount, method, accountInfo);
    }
};
exports.BalanceWithdrawalShopResolver = BalanceWithdrawalShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], BalanceWithdrawalShopResolver.prototype, "myBalanceWithFrozen", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], BalanceWithdrawalShopResolver.prototype, "myBalanceWithdrawals", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('amount')),
    __param(2, (0, graphql_1.Args)('method')),
    __param(3, (0, graphql_1.Args)('accountInfo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, String, String]),
    __metadata("design:returntype", Promise)
], BalanceWithdrawalShopResolver.prototype, "requestBalanceWithdrawal", null);
exports.BalanceWithdrawalShopResolver = BalanceWithdrawalShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [balance_withdrawal_service_1.BalanceWithdrawalService])
], BalanceWithdrawalShopResolver);
let BalanceWithdrawalAdminResolver = class BalanceWithdrawalAdminResolver {
    constructor(balanceWithdrawalService) {
        this.balanceWithdrawalService = balanceWithdrawalService;
    }
    async balanceWithdrawals(ctx, options) {
        return this.balanceWithdrawalService.findAll(ctx, options);
    }
    async approveBalanceWithdrawal(ctx, id, remark) {
        return this.balanceWithdrawalService.approve(ctx, id, remark);
    }
    async rejectBalanceWithdrawal(ctx, id, remark) {
        return this.balanceWithdrawalService.reject(ctx, id, remark);
    }
    async markBalanceWithdrawalPaid(ctx, id) {
        return this.balanceWithdrawalService.markPaid(ctx, id);
    }
};
exports.BalanceWithdrawalAdminResolver = BalanceWithdrawalAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], BalanceWithdrawalAdminResolver.prototype, "balanceWithdrawals", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('remark', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], BalanceWithdrawalAdminResolver.prototype, "approveBalanceWithdrawal", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('remark', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], BalanceWithdrawalAdminResolver.prototype, "rejectBalanceWithdrawal", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], BalanceWithdrawalAdminResolver.prototype, "markBalanceWithdrawalPaid", null);
exports.BalanceWithdrawalAdminResolver = BalanceWithdrawalAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [balance_withdrawal_service_1.BalanceWithdrawalService])
], BalanceWithdrawalAdminResolver);
//# sourceMappingURL=balance-withdrawal.resolvers.js.map