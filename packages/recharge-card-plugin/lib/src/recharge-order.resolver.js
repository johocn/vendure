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
exports.RechargeOrderResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const recharge_card_service_1 = require("./recharge-card.service");
let RechargeOrderResolver = class RechargeOrderResolver {
    constructor(rechargeCardService) {
        this.rechargeCardService = rechargeCardService;
    }
    async myRechargeOrders(ctx) {
        return this.rechargeCardService.findMyRechargeOrders(ctx);
    }
    async myBalanceTransactions(ctx, options) {
        return this.rechargeCardService.myBalanceTransactions(ctx, options);
    }
    async createRechargeOrder(ctx, amount, remark) {
        return this.rechargeCardService.createRechargeOrder(ctx, amount, remark);
    }
    async payRechargeOrder(ctx, id) {
        return this.rechargeCardService.payRechargeOrder(ctx, id);
    }
    async cancelRechargeOrder(ctx, id) {
        return this.rechargeCardService.cancelRechargeOrder(ctx, id);
    }
};
exports.RechargeOrderResolver = RechargeOrderResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], RechargeOrderResolver.prototype, "myRechargeOrders", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], RechargeOrderResolver.prototype, "myBalanceTransactions", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('amount')),
    __param(2, (0, graphql_1.Args)('remark', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, String]),
    __metadata("design:returntype", Promise)
], RechargeOrderResolver.prototype, "createRechargeOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number]),
    __metadata("design:returntype", Promise)
], RechargeOrderResolver.prototype, "payRechargeOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number]),
    __metadata("design:returntype", Promise)
], RechargeOrderResolver.prototype, "cancelRechargeOrder", null);
exports.RechargeOrderResolver = RechargeOrderResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [recharge_card_service_1.RechargeCardService])
], RechargeOrderResolver);
//# sourceMappingURL=recharge-order.resolver.js.map