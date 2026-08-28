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
exports.WalletAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const wallet_service_1 = require("./wallet.service");
let WalletAdminResolver = class WalletAdminResolver {
    constructor(walletService) {
        this.walletService = walletService;
    }
    async wallet(ctx) {
        return this.walletService.get(ctx);
    }
    async adminCreditWallet(ctx, amount) {
        return this.walletService.credit(ctx, amount);
    }
    async adminDebitWallet(ctx, amount) {
        return this.walletService.debit(ctx, amount);
    }
};
exports.WalletAdminResolver = WalletAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], WalletAdminResolver.prototype, "wallet", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('amount')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number]),
    __metadata("design:returntype", Promise)
], WalletAdminResolver.prototype, "adminCreditWallet", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('amount')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number]),
    __metadata("design:returntype", Promise)
], WalletAdminResolver.prototype, "adminDebitWallet", null);
exports.WalletAdminResolver = WalletAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [wallet_service_1.WalletService])
], WalletAdminResolver);
//# sourceMappingURL=wallet-admin.resolver.js.map