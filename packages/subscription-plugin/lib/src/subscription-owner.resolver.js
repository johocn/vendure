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
exports.SubscriptionOwnerResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const shop_plugin_1 = require("@vendure/shop-plugin");
const subscription_service_1 = require("./subscription.service");
/** 店主自营后台（ADMIN API）：本店套餐档管理 + 逐期指定内容 + 取消订阅。归属隔离强制在 service 业务层。 */
let SubscriptionOwnerResolver = class SubscriptionOwnerResolver {
    constructor(service) {
        this.service = service;
    }
    async myShopSubscriptionPlans(ctx, options) {
        return this.service.shopPlans(ctx, options);
    }
    async createSubscriptionPlan(ctx, input) {
        return this.service.createPlan(ctx, input);
    }
    async setSubscriptionOccurrenceItems(ctx, id, items) {
        return this.service.ownerSetOccurrenceItems(ctx, id, items);
    }
    async cancelSubscriptionOwner(ctx, id) {
        return this.service.cancelSubscription(ctx, id);
    }
};
exports.SubscriptionOwnerResolver = SubscriptionOwnerResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionOwnerResolver.prototype, "myShopSubscriptionPlans", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionOwnerResolver.prototype, "createSubscriptionPlan", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('items')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array]),
    __metadata("design:returntype", Promise)
], SubscriptionOwnerResolver.prototype, "setSubscriptionOccurrenceItems", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(shop_plugin_1.manageOwnShop.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionOwnerResolver.prototype, "cancelSubscriptionOwner", null);
exports.SubscriptionOwnerResolver = SubscriptionOwnerResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [subscription_service_1.SubscriptionService])
], SubscriptionOwnerResolver);
//# sourceMappingURL=subscription-owner.resolver.js.map