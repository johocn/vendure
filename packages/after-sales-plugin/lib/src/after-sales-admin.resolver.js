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
exports.AfterSalesAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const after_sales_service_1 = require("./after-sales.service");
let AfterSalesAdminResolver = class AfterSalesAdminResolver {
    constructor(afterSalesService) {
        this.afterSalesService = afterSalesService;
    }
    async afterSalesRequests(ctx, options) {
        return this.afterSalesService.findAll(ctx, options);
    }
    async afterSalesRequestAdmin(ctx, id) {
        return this.afterSalesService.findOneForAdmin(ctx, id);
    }
    async afterSalesStats(ctx, from, to) {
        return this.afterSalesService.stats(ctx, from, to);
    }
    async afterSalesReturnAddress(ctx) {
        return this.afterSalesService.getReturnAddress(ctx);
    }
    async updateAfterSalesReturnAddress(ctx, address) {
        return this.afterSalesService.updateReturnAddress(ctx, address);
    }
    async batchApproveAfterSalesRequests(ctx, ids) {
        return this.afterSalesService.batchApprove(ctx, ids);
    }
    async batchRejectAfterSalesRequests(ctx, ids, reason) {
        return this.afterSalesService.batchReject(ctx, ids, reason);
    }
    async approveAfterSalesRequest(ctx, id) {
        return this.afterSalesService.approveRequest(ctx, id);
    }
    async rejectAfterSalesRequest(ctx, id, reason) {
        return this.afterSalesService.rejectRequest(ctx, id, reason);
    }
    async arbitrateAfterSales(ctx, id, approve, note) {
        return this.afterSalesService.arbitrateRequest(ctx, id, approve, note);
    }
    async confirmReturnReceived(ctx, id, receivedQuantity) {
        return this.afterSalesService.confirmReceive(ctx, id, receivedQuantity);
    }
    async processAfterSalesRefund(ctx, id) {
        return this.afterSalesService.processRefund(ctx, id);
    }
    async retryAfterSalesRefund(ctx, id) {
        return this.afterSalesService.retryRefund(ctx, id);
    }
    async afterSalesMessages(ctx, id, options) {
        return this.afterSalesService.listMessages(ctx, id, 'admin', options);
    }
    async replyAfterSalesMessage(ctx, id, content, images) {
        return this.afterSalesService.addMessage(ctx, id, 'admin', content, images);
    }
    async exchangeShipAfterSalesRequest(ctx, id, trackingNo, carrier) {
        return this.afterSalesService.exchangeShip(ctx, id, trackingNo, carrier);
    }
};
exports.AfterSalesAdminResolver = AfterSalesAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], AfterSalesAdminResolver.prototype, "afterSalesRequests", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number]),
    __metadata("design:returntype", Promise)
], AfterSalesAdminResolver.prototype, "afterSalesRequestAdmin", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('from')),
    __param(2, (0, graphql_1.Args)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String]),
    __metadata("design:returntype", Promise)
], AfterSalesAdminResolver.prototype, "afterSalesStats", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], AfterSalesAdminResolver.prototype, "afterSalesReturnAddress", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('address')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], AfterSalesAdminResolver.prototype, "updateAfterSalesReturnAddress", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('ids', { type: () => [graphql_1.ID] })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], AfterSalesAdminResolver.prototype, "batchApproveAfterSalesRequests", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('ids', { type: () => [graphql_1.ID] })),
    __param(2, (0, graphql_1.Args)('reason')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array, String]),
    __metadata("design:returntype", Promise)
], AfterSalesAdminResolver.prototype, "batchRejectAfterSalesRequests", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number]),
    __metadata("design:returntype", Promise)
], AfterSalesAdminResolver.prototype, "approveAfterSalesRequest", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('reason')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, String]),
    __metadata("design:returntype", Promise)
], AfterSalesAdminResolver.prototype, "rejectAfterSalesRequest", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('approve', { type: () => Boolean })),
    __param(3, (0, graphql_1.Args)('note', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, Boolean, String]),
    __metadata("design:returntype", Promise)
], AfterSalesAdminResolver.prototype, "arbitrateAfterSales", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('receivedQuantity', { nullable: true, type: () => Number })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, Number]),
    __metadata("design:returntype", Promise)
], AfterSalesAdminResolver.prototype, "confirmReturnReceived", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number]),
    __metadata("design:returntype", Promise)
], AfterSalesAdminResolver.prototype, "processAfterSalesRefund", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number]),
    __metadata("design:returntype", Promise)
], AfterSalesAdminResolver.prototype, "retryAfterSalesRefund", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, Object]),
    __metadata("design:returntype", Promise)
], AfterSalesAdminResolver.prototype, "afterSalesMessages", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('content')),
    __param(3, (0, graphql_1.Args)('images', { nullable: true, type: () => [String] })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, String, Array]),
    __metadata("design:returntype", Promise)
], AfterSalesAdminResolver.prototype, "replyAfterSalesMessage", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('trackingNo')),
    __param(3, (0, graphql_1.Args)('carrier')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, String, String]),
    __metadata("design:returntype", Promise)
], AfterSalesAdminResolver.prototype, "exchangeShipAfterSalesRequest", null);
exports.AfterSalesAdminResolver = AfterSalesAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [after_sales_service_1.AfterSalesService])
], AfterSalesAdminResolver);
//# sourceMappingURL=after-sales-admin.resolver.js.map