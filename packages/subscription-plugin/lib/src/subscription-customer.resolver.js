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
exports.SubscriptionCustomerResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const subscription_service_1 = require("./subscription.service");
/** 买家自营（SHOP API）：查看可用套餐档/我的订阅/期次，买断开通与续订确认。全部 Permission.Owner，customerId 取 ctx.activeUserId。 */
let SubscriptionCustomerResolver = class SubscriptionCustomerResolver {
    constructor(service) {
        this.service = service;
    }
    async availablePlans(ctx, shopId, options) {
        return this.service.allPlans(ctx, options);
    }
    async mySubscriptions(ctx, options) {
        return this.service.customerSubscriptions(ctx, ctx.activeUserId, options);
    }
    async mySubscriptionOccurrences(ctx, subscriptionId, options) {
        return this.service.occurrencesOf(ctx, subscriptionId, options);
    }
    async createSubscription(ctx, planId, input) {
        return this.service.createSubscription(ctx, ctx.activeUserId, planId, input.startDate);
    }
    async confirmRenewal(ctx, id) {
        return this.service.initiateRenewal(ctx, id);
    }
};
exports.SubscriptionCustomerResolver = SubscriptionCustomerResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('shopId', { nullable: true })),
    __param(2, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionCustomerResolver.prototype, "availablePlans", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionCustomerResolver.prototype, "mySubscriptions", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('subscriptionId')),
    __param(2, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionCustomerResolver.prototype, "mySubscriptionOccurrences", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('planId')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionCustomerResolver.prototype, "createSubscription", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionCustomerResolver.prototype, "confirmRenewal", null);
exports.SubscriptionCustomerResolver = SubscriptionCustomerResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [subscription_service_1.SubscriptionService])
], SubscriptionCustomerResolver);
//# sourceMappingURL=subscription-customer.resolver.js.map