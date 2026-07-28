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
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const after_sales_request_entity_1 = require("./after-sales-request.entity");
const types_1 = require("./types");
let AfterSalesService = class AfterSalesService {
    constructor(connection, listQueryBuilder) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.orderService = null;
        this.options = {};
    }
    init(injector) {
        var _a;
        this.orderService = injector.get(core_1.OrderService);
        try {
            this.options = (_a = injector.get(constants_1.AFTER_SALES_PLUGIN_OPTIONS)) !== null && _a !== void 0 ? _a : {};
        }
        catch (_b) {
            this.options = {};
        }
    }
    async findOne(ctx, id) {
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const result = await repo.findOne({
            where: { id: id },
            relations: { order: true, orderLine: true, customer: true, channels: true },
        });
        return result !== null && result !== void 0 ? result : undefined;
    }
    /**
     * Shop API 专用：按 customerId 过滤，防止越权枚举他人售后单。
     */
    async findOneForCustomer(ctx, id) {
        const customerId = ctx.activeUserId;
        if (!customerId) {
            throw new core_1.UnauthorizedError();
        }
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const result = await repo.findOne({
            where: { id: id, customerId: customerId },
            relations: { order: true, orderLine: true, channels: true },
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
        var _a, _b;
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        if (!this.orderService) {
            throw new Error('OrderService not initialized');
        }
        // 1. 校验订单存在且归属当前用户
        const order = await this.orderService.findOne(ctx, input.orderId, ['customer', 'lines']);
        if (!order) {
            throw new core_1.UserInputError(`Order ${input.orderId} not found`);
        }
        if (!order.customer || String(order.customer.id) !== String(ctx.activeUserId)) {
            throw new core_1.ForbiddenError();
        }
        // 2. 校验订单状态（必须 Shipped/Delivered/PartialDelivery/Cancelled 才能售后）
        const allowedStates = ['Shipped', 'Delivered', 'PartialDelivery', 'Cancelled'];
        if (!allowedStates.includes(order.state)) {
            throw new core_1.UserInputError(`Cannot create after-sales: order state must be one of ${allowedStates.join('/')}, got ${order.state}`);
        }
        // 3. 售后期窗口校验（默认 7 天无理由 + 15 天质量问题 = 22 天上限）
        const maxDays = (_b = (_a = this.options) === null || _a === void 0 ? void 0 : _a.maxDaysAfterDelivery) !== null && _b !== void 0 ? _b : 7;
        const orderDate = order.updatedAt || order.createdAt;
        const daysSince = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > maxDays + 15) {
            throw new core_1.UserInputError(`Cannot create after-sales: exceeded ${maxDays + 15} days limit`);
        }
        // 4. 退款金额上限校验
        const orderLine = input.orderLineId
            ? order.lines.find(l => String(l.id) === String(input.orderLineId))
            : null;
        if (input.orderLineId && !orderLine) {
            throw new core_1.UserInputError(`Order line ${input.orderLineId} not found in order ${input.orderId}`);
        }
        const maxRefund = orderLine
            ? orderLine.proratedLinePrice
            : (order.totalQuantity > 0 ? order.total : 0);
        if (input.refundAmount > maxRefund) {
            throw new core_1.UserInputError(`Refund amount ${input.refundAmount} exceeds max ${maxRefund}`);
        }
        // 5. 重复售后校验（同一 orderLineId 不能有未关闭的售后单）
        if (input.orderLineId) {
            const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
            const existing = await repo.findOne({
                where: { orderLineId: input.orderLineId, state: (0, typeorm_1.Not)('Closed') },
            });
            if (existing) {
                throw new core_1.UserInputError(`After-sales already exists for order line ${input.orderLineId}`);
            }
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
        var _a;
        if (!this.orderService) {
            throw new Error('OrderService not initialized');
        }
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const request = await repo.findOne({
            where: { id: id },
            relations: ['order', 'order.payments'],
        });
        if (!request) {
            throw new core_1.EntityNotFoundError('AfterSalesRequest', id);
        }
        if (request.state !== 'Received') {
            throw new core_1.UserInputError('Cannot refund: request must be in Received state');
        }
        const payments = (_a = request.order) === null || _a === void 0 ? void 0 : _a.payments;
        if (!payments || payments.length === 0) {
            throw new core_1.UserInputError(`Cannot refund: no payment found for order ${request.orderId}`);
        }
        const paymentId = payments[0].id;
        // 事务包裹：退款成功后才改状态，避免“已退款但实际未退”脏数据
        await this.connection.startTransaction(ctx);
        try {
            // 1. 先调用 refundOrder（实际退款）
            await this.orderService.refundOrder(ctx, {
                paymentId,
                amount: request.refundAmount,
                reason: `After-sales refund #${request.id}`,
            });
            core_1.Logger.info(`Refund processed for after-sales request ${request.id}`, constants_1.loggerCtx);
            // 2. 退款成功后才改状态
            request.state = 'Refunded';
            await repo.save(request);
            // 3. 回写 Order customFields.afterSalesStatus
            await this.updateOrderAfterSalesStatus(ctx, request.orderId, 'Refunded');
            await this.connection.commitOpenTransaction(ctx);
        }
        catch (e) {
            await this.connection.rollBackTransaction(ctx);
            core_1.Logger.error(`Refund failed for after-sales #${id}: ${e.message}`, constants_1.loggerCtx);
            throw e;
        }
        return request;
    }
    /**
     * 回写 Order customFields.afterSalesStatus。失败仅告警，不影响主流程。
     */
    async updateOrderAfterSalesStatus(ctx, orderId, status) {
        if (!this.orderService)
            return;
        try {
            await this.orderService.updateCustomFields(ctx, orderId, { afterSalesStatus: status });
        }
        catch (e) {
            core_1.Logger.warn(`Failed to update order afterSalesStatus: ${e.message}`, constants_1.loggerCtx);
        }
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