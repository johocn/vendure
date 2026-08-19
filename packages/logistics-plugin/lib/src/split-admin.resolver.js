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
exports.SplitAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const auto_split_plan_service_1 = require("./auto-split-plan.service");
const manual_split_adjust_service_1 = require("./manual-split-adjust.service");
let SplitAdminResolver = class SplitAdminResolver {
    constructor(autoSplit, manualSplit) {
        this.autoSplit = autoSplit;
        this.manualSplit = manualSplit;
    }
    async splitPlanPreview(ctx, orderId) {
        return this.autoSplit.buildAutoPlan(ctx, orderId);
    }
    async confirmSplitPlan(ctx, orderId, packages) {
        return this.manualSplit.applyAdjustment(ctx, orderId, packages);
    }
};
exports.SplitAdminResolver = SplitAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], SplitAdminResolver.prototype, "splitPlanPreview", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('packages')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Array]),
    __metadata("design:returntype", Promise)
], SplitAdminResolver.prototype, "confirmSplitPlan", null);
exports.SplitAdminResolver = SplitAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [auto_split_plan_service_1.AutoSplitPlanService,
        manual_split_adjust_service_1.ManualSplitAdjustService])
], SplitAdminResolver);
//# sourceMappingURL=split-admin.resolver.js.map