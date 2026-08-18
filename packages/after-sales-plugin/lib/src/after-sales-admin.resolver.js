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
    async approveAfterSalesRequest(ctx, id) {
        return this.afterSalesService.approveRequest(ctx, id);
    }
    async rejectAfterSalesRequest(ctx, id, reason) {
        return this.afterSalesService.rejectRequest(ctx, id, reason);
    }
    async confirmReturnReceived(ctx, id, receivedQuantity) {
        return this.afterSalesService.confirmReceive(ctx, id, receivedQuantity);
    }
    async processAfterSalesRefund(ctx, id) {
        return this.afterSalesService.processRefund(ctx, id);
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
exports.AfterSalesAdminResolver = AfterSalesAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [after_sales_service_1.AfterSalesService])
], AfterSalesAdminResolver);
//# sourceMappingURL=after-sales-admin.resolver.js.map