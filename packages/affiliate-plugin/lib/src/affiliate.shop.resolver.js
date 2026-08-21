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
exports.AffiliateShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const affiliate_service_1 = require("./affiliate.service");
/**
 * C 端分销接口。身份均从 activeUserId 解析（推广员档案 / 顾客绑定），无需额外权限参数。
 */
let AffiliateShopResolver = class AffiliateShopResolver {
    constructor(service) {
        this.service = service;
    }
    /** 当前用户的推广员档案。 */
    async myAffiliate(ctx) {
        return this.service.myAffiliate(ctx);
    }
    /** 当前用户的佣金明细（createdAt DESC）。 */
    async myCommissionEntries(ctx) {
        return this.service.myCommissionEntries(ctx);
    }
    /** 成为推广员（shopId 可空，空=全局推广）。 */
    async becomeAffiliate(ctx, shopId) {
        return this.service.becomeAffiliate(ctx, shopId);
    }
    /** 顾客绑定推广关系。 */
    async bindAffiliate(ctx, code, source) {
        return this.service.bindRelation(ctx, code, source);
    }
    /** 申请提现。 */
    async requestWithdrawal(ctx, amount) {
        return this.service.requestWithdrawal(ctx, amount);
    }
};
exports.AffiliateShopResolver = AffiliateShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], AffiliateShopResolver.prototype, "myAffiliate", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], AffiliateShopResolver.prototype, "myCommissionEntries", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('shopId', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], AffiliateShopResolver.prototype, "becomeAffiliate", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('code')),
    __param(2, (0, graphql_1.Args)('source', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String]),
    __metadata("design:returntype", Promise)
], AffiliateShopResolver.prototype, "bindAffiliate", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('amount')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number]),
    __metadata("design:returntype", Promise)
], AffiliateShopResolver.prototype, "requestWithdrawal", null);
exports.AffiliateShopResolver = AffiliateShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [affiliate_service_1.AffiliateService])
], AffiliateShopResolver);
//# sourceMappingURL=affiliate.shop.resolver.js.map