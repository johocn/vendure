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
exports.SubscriptionAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const subscription_plan_entity_1 = require("./subscription-plan.entity");
const subscription_service_1 = require("./subscription.service");
/** 平台管理端（ADMIN API）：全部套餐档/订阅/期次查看 + 停用套餐档。 */
let SubscriptionAdminResolver = class SubscriptionAdminResolver {
    constructor(service, connection) {
        this.service = service;
        this.connection = connection;
    }
    async subscriptionPlans(ctx, options) {
        return this.service.allPlans(ctx, options);
    }
    async subscriptions(ctx, options) {
        return this.service.allSubscriptions(ctx, options);
    }
    async subscriptionOccurrences(ctx, options) {
        return this.service.allOccurrences(ctx, options);
    }
    async setSubscriptionPlanEnabled(ctx, id, enabled) {
        const repo = this.connection.getRepository(ctx, subscription_plan_entity_1.SubscriptionPlan);
        const plan = await repo.findOne({ where: { id: Number(id) } });
        if (!plan) {
            throw new Error('Plan not found');
        }
        plan.enabled = enabled;
        return repo.save(plan);
    }
};
exports.SubscriptionAdminResolver = SubscriptionAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionAdminResolver.prototype, "subscriptionPlans", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionAdminResolver.prototype, "subscriptions", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionAdminResolver.prototype, "subscriptionOccurrences", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateSettings),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('enabled')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Boolean]),
    __metadata("design:returntype", Promise)
], SubscriptionAdminResolver.prototype, "setSubscriptionPlanEnabled", null);
exports.SubscriptionAdminResolver = SubscriptionAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [subscription_service_1.SubscriptionService,
        core_1.TransactionalConnection])
], SubscriptionAdminResolver);
//# sourceMappingURL=subscription-admin.resolver.js.map