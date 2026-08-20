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
const order_complete_auto_service_1 = require("./order-complete-auto.service");
const order_package_service_1 = require("./order-package.service");
let SplitAdminResolver = class SplitAdminResolver {
    constructor(autoSplit, manualSplit, orderPackageService, orderCompleteAuto, orderService) {
        this.autoSplit = autoSplit;
        this.manualSplit = manualSplit;
        this.orderPackageService = orderPackageService;
        this.orderCompleteAuto = orderCompleteAuto;
        this.orderService = orderService;
    }
    async splitPlanPreview(ctx, orderId) {
        return this.autoSplit.buildAutoPlan(ctx, orderId);
    }
    /** 订单级包裹查询：按包追溯 仓/行/运费/履约/配送 */
    async orderPackages(ctx, orderId) {
        const list = await this.orderPackageService.findByOrder(ctx, orderId);
        return list.map((p) => ({
            id: p.id,
            code: p.code,
            orderId: p.orderId,
            stockLocationId: p.stockLocationId,
            lines: p.linesJson ? JSON.parse(p.linesJson) : [],
            shippingFee: p.shippingFee,
            deliveryMode: p.deliveryMode,
            fulfillmentId: p.fulfillmentId,
            deliveryOrderId: p.deliveryOrderId,
            status: p.status,
            shippedAt: p.shippedAt,
            deliveredAt: p.deliveredAt,
            cancelledAt: p.cancelledAt,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
        }));
    }
    async confirmSplitPlan(ctx, orderId, packages) {
        const plan = await this.manualSplit.applyAdjustment(ctx, orderId, packages);
        // 挂钩点1：拆单确认成功 → 把内存计划持久化为 OrderPackage（先删后插，幂等）
        await this.orderPackageService.replaceForOrder(ctx, orderId, plan.packages.map(p => ({
            packageId: p.packageId,
            stockLocationId: p.stockLocationId,
            lines: p.lines,
            estimatedShippingFee: p.estimatedShippingFee,
            deliveryMode: p.deliveryMode,
        })));
        return plan;
    }
    /** self 包人工送达确认：OrderPackage shipped→delivered（幂等；非法状态返回 false） */
    async markPackageDelivered(ctx, orderId, packageId) {
        return this.orderPackageService.transition(ctx, orderId, packageId, 'delivered');
    }
    /** 手动交易完成：Delivered → Completed（幂等；非 Delivered 状态返回 false） */
    async completeOrder(ctx, orderId) {
        const order = await this.orderService.findOne(ctx, orderId);
        if (!order)
            return false;
        if (order.state === 'Completed')
            return true; // 幂等
        if (order.state !== 'Delivered')
            return false; // 仅 Delivered 可确认收货
        const result = await this.orderService.transitionToState(ctx, orderId, 'Completed');
        return !(0, core_1.isGraphQlErrorResult)(result);
    }
    /** 手动触发自动交易完成扫描，返回本次完成订单数（运营/e2e 用） */
    async runAutoCompleteScan(ctx) {
        return this.orderCompleteAuto.runAutoCompleteScan(ctx);
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
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], SplitAdminResolver.prototype, "orderPackages", null);
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
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('packageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String]),
    __metadata("design:returntype", Promise)
], SplitAdminResolver.prototype, "markPackageDelivered", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], SplitAdminResolver.prototype, "completeOrder", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], SplitAdminResolver.prototype, "runAutoCompleteScan", null);
exports.SplitAdminResolver = SplitAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [auto_split_plan_service_1.AutoSplitPlanService,
        manual_split_adjust_service_1.ManualSplitAdjustService,
        order_package_service_1.OrderPackageService,
        order_complete_auto_service_1.OrderCompleteAutoService,
        core_1.OrderService])
], SplitAdminResolver);
//# sourceMappingURL=split-admin.resolver.js.map