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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AfterSalesService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const after_sales_request_entity_1 = require("./after-sales-request.entity");
const types_1 = require("./types");
let AfterSalesService = class AfterSalesService {
    constructor(connection, listQueryBuilder) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.orderService = null;
    }
    init(injector) {
        this.orderService = injector.get(core_1.OrderService);
    }
    async findOne(ctx, id) {
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const result = await repo.findOne({
            where: { id: id },
            relations: { order: true, orderLine: true, customer: true, channels: true },
        });
        return result !== null && result !== void 0 ? result : undefined;
    }
    async findMyRequests(ctx, options) {
        return this.listQueryBuilder
            .build(after_sales_request_entity_1.AfterSalesRequest, options, {
            ctx,
            relations: ['order', 'orderLine', 'channels'],
            channelId: ctx.channelId,
        })
            .andWhere('afterSalesRequest.customerId = :customerId', { customerId: ctx.activeUserId })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    async findAll(ctx, options) {
        return this.listQueryBuilder
            .build(after_sales_request_entity_1.AfterSalesRequest, options, {
            ctx,
            relations: ['order', 'orderLine', 'customer', 'channels'],
            channelId: ctx.channelId,
        })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    async createRequest(ctx, input) {
        if (!ctx.activeUserId) {
            throw new Error('Must be logged in to create an after-sales request');
        }
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const request = new after_sales_request_entity_1.AfterSalesRequest({
            orderId: input.orderId,
            orderLineId: input.orderLineId || null,
            type: input.type || 'return_refund',
            state: 'Pending',
            reason: input.reason,
            description: input.description || null,
            evidenceImages: input.evidenceImages || null,
            refundAmount: input.refundAmount,
            customerId: ctx.activeUserId,
        });
        request.channels = [ctx.channel];
        const saved = await repo.save(request);
        core_1.Logger.info(`After-sales request ${saved.id} created by customer ${ctx.activeUserId}`, constants_1.loggerCtx);
        return saved;
    }
    async cancelRequest(ctx, id) {
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id } });
        if (!request)
            throw new Error('Request not found');
        if (request.state !== 'Pending') {
            throw new Error(`Cannot cancel request in state: ${request.state}`);
        }
        request.state = 'Closed';
        return repo.save(request);
    }
    async updateReturnTracking(ctx, id, trackingNo, carrier) {
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id } });
        if (!request)
            throw new Error('Request not found');
        if (request.state !== 'Approved') {
            throw new Error(`Cannot update tracking in state: ${request.state}`);
        }
        request.returnTrackingNo = trackingNo;
        request.returnCarrier = carrier;
        request.state = 'Returning';
        return repo.save(request);
    }
    // ===== Admin Operations =====
    async approveRequest(ctx, id) {
        return this.transitionState(ctx, id, 'Approved');
    }
    async rejectRequest(ctx, id, reason) {
        var _a;
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id } });
        if (!request)
            throw new Error('Request not found');
        if (!((_a = types_1.STATE_TRANSITIONS[request.state]) === null || _a === void 0 ? void 0 : _a.includes('Rejected'))) {
            throw new Error(`Cannot reject from state: ${request.state}`);
        }
        request.state = 'Rejected';
        request.rejectReason = reason;
        return repo.save(request);
    }
    async confirmReceive(ctx, id) {
        return this.transitionState(ctx, id, 'Received');
    }
    async processRefund(ctx, id) {
        var _a, _b, _c;
        const request = await this.transitionState(ctx, id, 'Refunded');
        // Trigger actual refund via OrderService
        if (this.orderService) {
            try {
                await this.orderService.refundOrder(ctx, {
                    lines: request.orderLineId
                        ? [{ orderLineId: request.orderLineId, quantity: 1 }]
                        : [],
                    shipping: 0,
                    adjustment: 0,
                    paymentId: (_c = (_b = (_a = request.order) === null || _a === void 0 ? void 0 : _a.payments) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.id,
                    reason: `After-sales refund #${request.id}`,
                });
                core_1.Logger.info(`Refund processed for after-sales request ${request.id}`, constants_1.loggerCtx);
            }
            catch (e) {
                core_1.Logger.error(`Refund failed for after-sales request ${request.id}: ${e.message}`, constants_1.loggerCtx);
            }
        }
        return request;
    }
    async transitionState(ctx, id, toState) {
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id } });
        if (!request)
            throw new Error('Request not found');
        const allowed = types_1.STATE_TRANSITIONS[request.state];
        if (!(allowed === null || allowed === void 0 ? void 0 : allowed.includes(toState))) {
            throw new Error(`Invalid transition: ${request.state} -> ${toState}`);
        }
        request.state = toState;
        return repo.save(request);
    }
};
exports.AfterSalesService = AfterSalesService;
exports.AfterSalesService = AfterSalesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder])
], AfterSalesService);
//# sourceMappingURL=after-sales.service.js.map