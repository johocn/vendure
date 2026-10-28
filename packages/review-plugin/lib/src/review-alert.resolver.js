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
exports.ReviewAlertResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const review_alert_entity_1 = require("./review-alert.entity");
const review_alert_service_1 = require("./review-alert.service");
/** P4-2 评价品质闭环：预警规则读写 + 预警列表/详情/回评/补券/关闭。 */
let ReviewAlertResolver = class ReviewAlertResolver {
    constructor(alertService) {
        this.alertService = alertService;
    }
    async reviewAlertRule(ctx) {
        return this.alertService.getRule(ctx);
    }
    async reviewAlerts(ctx, options) {
        return this.alertService.getAlerts(ctx, options);
    }
    async reviewAlert(ctx, id) {
        return this.alertService.getAlert(ctx, id);
    }
    async reviewAlertStats(ctx) {
        return this.alertService.getStats(ctx);
    }
    async updateReviewAlertRule(ctx, input) {
        return this.alertService.updateRule(ctx, input !== null && input !== void 0 ? input : {});
    }
    async replyReviewAlert(ctx, id, reply) {
        return this.alertService.replyAlert(ctx, id, reply);
    }
    async resendReviewAlertCoupon(ctx, id) {
        return this.alertService.resendCoupon(ctx, id);
    }
    async closeReviewAlert(ctx, id, note) {
        return this.alertService.closeAlert(ctx, id, note);
    }
    async productName(ctx, alert) {
        return this.alertService.getProductName(ctx, alert);
    }
};
exports.ReviewAlertResolver = ReviewAlertResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], ReviewAlertResolver.prototype, "reviewAlertRule", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ReviewAlertResolver.prototype, "reviewAlerts", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ReviewAlertResolver.prototype, "reviewAlert", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], ReviewAlertResolver.prototype, "reviewAlertStats", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ReviewAlertResolver.prototype, "updateReviewAlertRule", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('reply')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], ReviewAlertResolver.prototype, "replyReviewAlert", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ReviewAlertResolver.prototype, "resendReviewAlertCoupon", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)({ name: 'note', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], ReviewAlertResolver.prototype, "closeReviewAlert", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, review_alert_entity_1.ReviewAlert]),
    __metadata("design:returntype", Promise)
], ReviewAlertResolver.prototype, "productName", null);
exports.ReviewAlertResolver = ReviewAlertResolver = __decorate([
    (0, graphql_1.Resolver)('ReviewAlert'),
    __metadata("design:paramtypes", [review_alert_service_1.ReviewAlertService])
], ReviewAlertResolver);
//# sourceMappingURL=review-alert.resolver.js.map