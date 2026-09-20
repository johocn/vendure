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
exports.AdminSyncResolver = void 0;
const common_1 = require("@nestjs/common");
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
const incremental_sync_service_1 = require("../services/incremental-sync.service");
const sync_order_service_1 = require("../services/sync-order.service");
const sync_payment_service_1 = require("../services/sync-payment.service");
const sync_session_service_1 = require("../services/sync-session.service");
let AdminSyncResolver = class AdminSyncResolver {
    constructor(syncOrderService, syncPaymentService, syncSessionService, incrementalSyncService) {
        this.syncOrderService = syncOrderService;
        this.syncPaymentService = syncPaymentService;
        this.syncSessionService = syncSessionService;
        this.incrementalSyncService = incrementalSyncService;
    }
    async syncOrders(input, ctx) {
        const succeeded = [];
        const failed = [];
        for (const order of input.orders) {
            const result = await this.syncOrderService.syncSingleOrder(ctx, order);
            if (result.status === 'failed') {
                failed.push(result);
            }
            else {
                succeeded.push(result);
            }
        }
        return { succeeded, failed };
    }
    async syncPayments(input, ctx) {
        const succeeded = [];
        const failed = [];
        for (const payment of input.payments) {
            const result = await this.syncPaymentService.syncSinglePayment(ctx, payment);
            if (result.status === 'failed') {
                failed.push(result);
            }
            else {
                succeeded.push(result);
            }
        }
        return { succeeded, failed };
    }
    async syncSessions(input, ctx) {
        const succeeded = [];
        const failed = [];
        for (const session of input.sessions) {
            const result = await this.syncSessionService.syncSingleSession(ctx, session);
            if (result.status === 'failed') {
                failed.push(result);
            }
            else {
                succeeded.push(result);
            }
        }
        return { succeeded, failed };
    }
    async syncProducts(since, limit, ctx) {
        return this.incrementalSyncService.syncProducts(ctx, since, limit);
    }
    async syncMembers(since, limit, ctx) {
        return this.incrementalSyncService.syncMembers(ctx, since, limit);
    }
};
exports.AdminSyncResolver = AdminSyncResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.offlineSyncPermission.Update),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], AdminSyncResolver.prototype, "syncOrders", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.offlineSyncPermission.Update),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], AdminSyncResolver.prototype, "syncPayments", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(constants_1.offlineSyncPermission.Update),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], AdminSyncResolver.prototype, "syncSessions", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.offlineSyncPermission.Read),
    __param(0, (0, graphql_1.Args)('since')),
    __param(1, (0, graphql_1.Args)('limit')),
    __param(2, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Date, Number, core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], AdminSyncResolver.prototype, "syncProducts", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(constants_1.offlineSyncPermission.Read),
    __param(0, (0, graphql_1.Args)('since')),
    __param(1, (0, graphql_1.Args)('limit')),
    __param(2, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Date, Number, core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], AdminSyncResolver.prototype, "syncMembers", null);
exports.AdminSyncResolver = AdminSyncResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __param(0, (0, common_1.Inject)(sync_order_service_1.SyncOrderService)),
    __param(1, (0, common_1.Inject)(sync_payment_service_1.SyncPaymentService)),
    __param(2, (0, common_1.Inject)(sync_session_service_1.SyncSessionService)),
    __param(3, (0, common_1.Inject)(incremental_sync_service_1.IncrementalSyncService)),
    __metadata("design:paramtypes", [sync_order_service_1.SyncOrderService,
        sync_payment_service_1.SyncPaymentService,
        sync_session_service_1.SyncSessionService,
        incremental_sync_service_1.IncrementalSyncService])
], AdminSyncResolver);
//# sourceMappingURL=admin-sync.resolver.js.map