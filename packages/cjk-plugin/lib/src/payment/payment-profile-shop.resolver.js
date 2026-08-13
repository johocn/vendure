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
exports.PaymentProfileShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const payment_profile_service_1 = require("./payment-profile.service");
let PaymentProfileShopResolver = class PaymentProfileShopResolver {
    constructor(service) {
        this.service = service;
    }
    async eligiblePaymentMethodsByProfile(ctx, profileIds) {
        const intersected = await this.service.getIntersectedPaymentMethods(ctx, profileIds);
        if (intersected.length === 0)
            return [];
        return this.service.findPaymentMethodsByIds(ctx, intersected.map(m => m.id));
    }
    async eligibleInstallmentOptions(ctx, profileIds) {
        return this.service.getIntersectedInstallmentOptions(ctx, profileIds);
    }
    async checkPaymentProfileCompatibility(ctx, profileIds) {
        const methods = await this.service.getIntersectedPaymentMethods(ctx, profileIds);
        return {
            compatible: methods.length > 0,
            intersectedCount: methods.length,
        };
    }
};
exports.PaymentProfileShopResolver = PaymentProfileShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('profileIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], PaymentProfileShopResolver.prototype, "eligiblePaymentMethodsByProfile", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('profileIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], PaymentProfileShopResolver.prototype, "eligibleInstallmentOptions", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('profileIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], PaymentProfileShopResolver.prototype, "checkPaymentProfileCompatibility", null);
exports.PaymentProfileShopResolver = PaymentProfileShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [payment_profile_service_1.PaymentProfileService])
], PaymentProfileShopResolver);
//# sourceMappingURL=payment-profile-shop.resolver.js.map