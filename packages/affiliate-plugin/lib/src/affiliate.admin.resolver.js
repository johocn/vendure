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
exports.AffiliateAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const affiliate_service_1 = require("./affiliate.service");
/**
 * 管理端分销接口。affiliates 返回本 channel 全量推广员；pay/reject 提现经 service.requireMyShop
 * 校验调用者为 active 店主（归属隔离由 Shop.administratorId 把关）。
 */
let AffiliateAdminResolver = class AffiliateAdminResolver {
    constructor(service) {
        this.service = service;
    }
    /** 本 channel 全量推广员。 */
    async affiliates(ctx) {
        return this.service.affiliates(ctx);
    }
    /** 店主支付提现（幂等）。schema 仅需 Authenticated 保底，真正授权由 service.requireMyShop 把关。 */
    async payWithdrawal(ctx, id) {
        return this.service.payWithdrawalSafe(ctx, id);
    }
    /** 店主拒绝提现（幂等）。 */
    async rejectWithdrawal(ctx, id) {
        return this.service.rejectWithdrawalSafe(ctx, id);
    }
};
exports.AffiliateAdminResolver = AffiliateAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], AffiliateAdminResolver.prototype, "affiliates", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], AffiliateAdminResolver.prototype, "payWithdrawal", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], AffiliateAdminResolver.prototype, "rejectWithdrawal", null);
exports.AffiliateAdminResolver = AffiliateAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [affiliate_service_1.AffiliateService])
], AffiliateAdminResolver);
//# sourceMappingURL=affiliate.admin.resolver.js.map