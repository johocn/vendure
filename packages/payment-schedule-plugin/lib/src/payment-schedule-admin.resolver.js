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
exports.PaymentScheduleAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const payment_schedule_service_1 = require("./payment-schedule.service");
let PaymentScheduleAdminResolver = class PaymentScheduleAdminResolver {
    constructor(scheduleService) {
        this.scheduleService = scheduleService;
    }
    async paymentSchedules(ctx, options) {
        const page = await this.scheduleService.listSchedules(ctx, options);
        const withItems = await Promise.all(page.items.map(async (s) => ({
            schedule: s,
            items: await this.scheduleService.findItemsForPresent(ctx, Number(s.id)),
        })));
        return {
            items: withItems.map(w => this.scheduleService.presentSchedule(w)),
            totalItems: page.totalItems,
        };
    }
    async adminPaymentSchedule(ctx, id) {
        const withItems = await this.scheduleService.getScheduleById(ctx, Number(id));
        return withItems ? this.scheduleService.presentSchedule(withItems) : null;
    }
    async openTailWindow(ctx, scheduleId) {
        const result = await this.scheduleService.openTailWindow(ctx, Number(scheduleId));
        return this.scheduleService.presentSchedule(result);
    }
    async confirmSellerBreach(ctx, scheduleId) {
        const result = await this.scheduleService.confirmSellerBreach(ctx, Number(scheduleId));
        return this.scheduleService.presentSchedule(result);
    }
    async confirmCodReceived(ctx, orderId) {
        const result = await this.scheduleService.confirmCodReceived(ctx, orderId);
        return this.scheduleService.presentSchedule(result);
    }
    async releaseRentalDeposit(ctx, orderId) {
        const result = await this.scheduleService.releaseDepositForRental(ctx, orderId);
        return this.scheduleService.presentSchedule(result);
    }
    /** 手动触发调度扫描（运维工具 + e2e 依赖；与每分钟 ScheduledTask 等价） */
    async runScheduleScan(ctx) {
        const triggers = await this.scheduleService.processTriggers(ctx);
        const overdues = await this.scheduleService.processOverdue(ctx);
        const shipBreaches = await this.scheduleService.processShipDeadlines(ctx);
        return { activated: triggers.activated, overdue: overdues.overdue, shipBreaches };
    }
};
exports.PaymentScheduleAdminResolver = PaymentScheduleAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PaymentScheduleAdminResolver.prototype, "paymentSchedules", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PaymentScheduleAdminResolver.prototype, "adminPaymentSchedule", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('scheduleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PaymentScheduleAdminResolver.prototype, "openTailWindow", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('scheduleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PaymentScheduleAdminResolver.prototype, "confirmSellerBreach", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PaymentScheduleAdminResolver.prototype, "confirmCodReceived", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PaymentScheduleAdminResolver.prototype, "releaseRentalDeposit", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], PaymentScheduleAdminResolver.prototype, "runScheduleScan", null);
exports.PaymentScheduleAdminResolver = PaymentScheduleAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [payment_schedule_service_1.PaymentScheduleService])
], PaymentScheduleAdminResolver);
