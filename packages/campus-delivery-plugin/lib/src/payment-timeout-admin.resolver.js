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
exports.PaymentTimeoutAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const payment_timeout_admin_service_1 = require("./payment-timeout-admin.service");
/** 待付款超时任务的运营后台查询 / 统计 / 手动执行（权限按订单读写走） */
let PaymentTimeoutAdminResolver = class PaymentTimeoutAdminResolver {
    constructor(admin) {
        this.admin = admin;
    }
    async paymentTimeoutTasks(ctx, status, type, from, to, skip, take) {
        return this.admin.listTasks({ status, type, from, to, skip, take });
    }
    async paymentTimeoutStats(ctx) {
        return this.admin.getStats();
    }
    async executePaymentTimeoutTask(ctx, id) {
        return this.admin.executeTask(Number(id));
    }
    async resendPaymentTimeoutRemind(ctx, taskId) {
        return this.admin.resendRemind(Number(taskId));
    }
    async runPaymentTimeoutCompensation(ctx) {
        return this.admin.runCompensationNow();
    }
};
exports.PaymentTimeoutAdminResolver = PaymentTimeoutAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'status', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'type', type: () => String, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'from', type: () => Date, nullable: true })),
    __param(4, (0, graphql_1.Args)({ name: 'to', type: () => Date, nullable: true })),
    __param(5, (0, graphql_1.Args)({ name: 'skip', type: () => graphql_1.Int, nullable: true })),
    __param(6, (0, graphql_1.Args)({ name: 'take', type: () => graphql_1.Int, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String, Date,
        Date, Number, Number]),
    __metadata("design:returntype", Promise)
], PaymentTimeoutAdminResolver.prototype, "paymentTimeoutTasks", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], PaymentTimeoutAdminResolver.prototype, "paymentTimeoutStats", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'id', type: () => graphql_1.ID })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PaymentTimeoutAdminResolver.prototype, "executePaymentTimeoutTask", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'taskId', type: () => graphql_1.ID })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PaymentTimeoutAdminResolver.prototype, "resendPaymentTimeoutRemind", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], PaymentTimeoutAdminResolver.prototype, "runPaymentTimeoutCompensation", null);
exports.PaymentTimeoutAdminResolver = PaymentTimeoutAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [payment_timeout_admin_service_1.PaymentTimeoutAdminService])
], PaymentTimeoutAdminResolver);
//# sourceMappingURL=payment-timeout-admin.resolver.js.map