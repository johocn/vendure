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
const inventory_plugin_1 = require("@vendure/inventory-plugin");
let AfterSalesService = class AfterSalesService {
    constructor(connection, listQueryBuilder) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.orderService = null;
        this.inventoryService = null;
        this.options = {};
    }
    init(injector) {
        var _a, _b;
        this.orderService = injector.get(core_1.OrderService);
        try {
            this.inventoryService = injector.get(inventory_plugin_1.InventoryService);
        }
        catch (e) {
            this.inventoryService = null;
            core_1.Logger.warn(`InventoryService 不可用，售后回补库存被禁用: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
        }
        try {
            this.options = (_b = injector.get(constants_1.AFTER_SALES_PLUGIN_OPTIONS)) !== null && _b !== void 0 ? _b : {};
        }
        catch (_c) {
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
            .andWhere('aftersalesrequest."customerId" = :customerId', { customerId: ctx.activeUserId })
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
        var _a, _b, _c, _d, _e, _f;
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        if (!this.orderService) {
            throw new Error('OrderService not initialized');
        }
        // 1. 校验订单存在且归属当前用户。
        // 注意：order.customer.id 是 Customer 主键，而 ctx.activeUserId 是关联 User 主键，两者不同。
        // 归属校验必须基于 customer.user.id 与 activeUserId 比较。
        let order;
        try {
            order = await this.orderService.findOne(ctx, input.orderId, ['customer', 'customer.user', 'lines']);
        }
        catch (e) {
            throw e;
        }
        if (!order) {
            throw new core_1.UserInputError(`Order ${input.orderId} not found`);
        }
        const customerUserId = (_b = (_a = order.customer) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id;
        if (!order.customer || customerUserId == null || String(customerUserId) !== String(ctx.activeUserId)) {
            throw new core_1.ForbiddenError();
        }
        // 2. 校验订单状态（必须 Shipped/Delivered/PartiallyDelivered/Completed/Cancelled 才能售后）
        const allowedStates = ['Shipped', 'Delivered', 'PartiallyDelivered', 'Completed', 'Cancelled'];
        if (!allowedStates.includes(order.state)) {
            throw new core_1.UserInputError(`Cannot create after-sales: order state must be one of ${allowedStates.join('/')}, got ${order.state}`);
        }
        // 3. 售后期窗口校验（默认 7 天无理由 + 15 天质量问题 = 22 天上限）。
        // 计时起点优先取交易完成时间 fulfillmentCompletedAt（阶段10 确认收货/自动完成落库），
        // 其次首次送达 fulfillmentDeliveredAt，最后回退订单 updatedAt。
        const maxDays = (_d = (_c = this.options) === null || _c === void 0 ? void 0 : _c.maxDaysAfterDelivery) !== null && _d !== void 0 ? _d : 7;
        const completedAt = (_e = order.customFields) === null || _e === void 0 ? void 0 : _e.fulfillmentCompletedAt;
        const deliveredAt = (_f = order.customFields) === null || _f === void 0 ? void 0 : _f.fulfillmentDeliveredAt;
        const orderDate = completedAt || deliveredAt || order.updatedAt || order.createdAt;
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
        // 4.1 用解码后的实体 ID 存储外键：order.id / line.id 已是数据库内部数字 ID，
        // 不能直接用 GraphQL 编码 ID（T_1）写入 number 外键列，否则触发 FOREIGN KEY 约束失败。
        const entityOrderId = order.id;
        const entityOrderLineId = orderLine ? orderLine.id : null;
        // 5. 重复售后校验（同一 orderLineId 不能有未关闭的售后单）
        if (entityOrderLineId != null) {
            const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
            const existing = await repo.findOne({
                where: { orderLineId: entityOrderLineId, state: (0, typeorm_1.Not)('Closed') },
            });
            if (existing) {
                throw new core_1.UserInputError(`After-sales already exists for order line ${input.orderLineId}`);
            }
        }
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const request = new after_sales_request_entity_1.AfterSalesRequest({
            orderId: entityOrderId,
            orderLineId: entityOrderLineId,
            type: input.type || 'return_refund',
            state: 'Pending',
            reason: input.reason,
            description: input.description || null,
            evidenceImages: input.evidenceImages || null,
            refundAmount: input.refundAmount,
            customerId: order.customer.id,
        });
        request.channels = [ctx.channel];
        const saved = await repo.save(request);
        core_1.Logger.info(`After-sales request ${saved.id} created by customer ${ctx.activeUserId}`, constants_1.loggerCtx);
        return this.hydrate(ctx, saved.id);
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
        const saved = await repo.save(request);
        return this.hydrate(ctx, saved.id);
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
        const saved = await repo.save(request);
        return this.hydrate(ctx, saved.id);
    }
    /**
     * Mutation 保存后重新加载并返回带关系（order/orderLine）的实体。
     * 直接 repo.save() 返回的实体关系未加载，Shop SDL 中 `order: Order!` 非空字段会被自动关系解析取到 null，
     * 触发 "Cannot return null for non-nullable field AfterSalesRequest.order"。
     */
    async hydrate(ctx, id) {
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const full = await repo.findOne({
            where: { id: id },
            relations: { order: true, orderLine: true, channels: true },
        });
        if (full) {
            return full;
        }
        throw new Error(`AfterSalesRequest #${id} not found after save`);
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
    /**
     * Returning → Received（收到退货）：
     * 在状态流转前先做库存回补——把收到的退货回补到原发货仓（orderLine.stockLocationId），
     * 同一事务内写 afterSales 账本，避免“退款了但库存不回来”。回补失败不影响收退货流程（告警）。
     * @param receivedQuantity 实收数量（部分退货按实收回补；缺省按订单行数量全额回补）
     */
    async confirmReceive(ctx, id, receivedQuantity) {
        return this.connection.withTransaction(ctx, async (txCtx) => {
            var _a;
            const repo = this.connection.getRepository(txCtx, after_sales_request_entity_1.AfterSalesRequest);
            const request = await repo.findOne({
                where: { id: id },
                relations: ['orderLine'],
            });
            if (!request)
                throw new Error('Request not found');
            const allowed = types_1.STATE_TRANSITIONS[request.state];
            if (!(allowed === null || allowed === void 0 ? void 0 : allowed.includes('Received'))) {
                throw new Error(`Invalid transition: ${request.state} -> Received`);
            }
            // 实收数量：显式传入则记录；否则缺省为订单行数量（全额回补）
            const orderLine = request.orderLine;
            const orderedQty = orderLine ? Number(orderLine.quantity) || 0 : 0;
            if (receivedQuantity != null) {
                request.receivedQuantity = Math.max(0, Math.floor(receivedQuantity));
            }
            const recoverQty = Math.max(0, Math.min(orderedQty, request.receivedQuantity != null ? request.receivedQuantity : orderedQty));
            // 库存回补：按各仓实际发货比例多仓按包回补（单仓退化原逻辑），落 restockJson 留痕
            if (orderLine && this.inventoryService && recoverQty > 0) {
                try {
                    const restockDetail = await this.inventoryService.applyAfterSalesRestockMulti(txCtx, orderLine.id, recoverQty, `AS${request.id}`);
                    request.restockJson = restockDetail.length ? JSON.stringify(restockDetail) : null;
                    core_1.Logger.info(`库存回补 after-sales#${request.id}: ${JSON.stringify(restockDetail)}`, constants_1.loggerCtx);
                }
                catch (e) {
                    // 回补失败不阻断收退货流程（仍可退款），仅告警便于运维追查
                    core_1.Logger.error(`库存回补失败 after-sales#${request.id}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
                }
            }
            else if (recoverQty === 0) {
                core_1.Logger.warn(`after-sales#${request.id} recoverQty=0，跳过库存回补`, constants_1.loggerCtx);
            }
            else {
                core_1.Logger.warn(`after-sales#${request.id} 无订单行或 InventoryService 不可用，跳过库存回补`, constants_1.loggerCtx);
            }
            request.state = 'Received';
            return repo.save(request);
        });
    }
    async processRefund(ctx, id) {
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
        return this.executeRefund(ctx, request);
    }
    /**
     * 退款失败后重试：仅 RefundFailed 允许；复用 executeRefund 退款核心。
     */
    async retryRefund(ctx, id) {
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
        if (request.state !== 'RefundFailed') {
            throw new core_1.UserInputError('Cannot retry refund: request must be in RefundFailed state');
        }
        return this.executeRefund(ctx, request);
    }
    /**
     * 退款核心：调用 orderService.refundOrder 创建原生 Refund；若支付处理器将 Refund 停在 Pending
     * （真实网关异步对账场景），则再调 settleRefund 推进到 Settled 终态。
     * 仅当 Refund 达 Settled 才把售后单置 Refunded 并落账；失败则置 RefundFailed（留 refundError，可重试）。
     * 杜绝"已标退款但钱从未退回"的假退款脏数据。
     */
    async executeRefund(ctx, request) {
        var _a, _b;
        const payments = (_a = request.order) === null || _a === void 0 ? void 0 : _a.payments;
        if (!payments || payments.length === 0) {
            throw new core_1.UserInputError(`Cannot refund: no payment found for order ${request.orderId}`);
        }
        const paymentId = payments[0].id;
        // 事务包裹：退款成功后统一提交（改状态 + 落账 + 回写 order.afterSalesStatus），失败回滚整笔。
        await this.connection.startTransaction(ctx);
        try {
            const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
            const refundResult = await this.orderService.refundOrder(ctx, {
                paymentId,
                amount: request.refundAmount,
                reason: `After-sales refund #${request.id}`,
                shipping: 0, // Refund.shipping 为 NOT NULL 列，必须显式置 0
                adjustment: 0,
            });
            if ((0, core_1.isGraphQlErrorResult)(refundResult)) {
                // refundOrder 拒绝（如超额 RefundAmountError）：无实际退款发生，置 RefundFailed 留痕并提交
                request.state = 'RefundFailed';
                request.refundError = `refundOrder 拒绝: ${JSON.stringify(refundResult)}`;
                request.refundedAt = undefined;
                await repo.save(request);
                await this.updateOrderAfterSalesStatus(ctx, request.orderId, 'RefundFailed');
                await this.connection.commitOpenTransaction(ctx);
                core_1.Logger.warn(`after-sales #${request.id} refundOrder 拒绝: ${request.refundError}`, constants_1.loggerCtx);
                return this.hydrate(ctx, request.id);
            }
            const refund = refundResult; // Vendure 原生 Refund
            // 若仍停在 Pending（异步对账/需手动落定场景），推进到 Settled 终态
            if (refund.state === 'Pending') {
                const settled = await this.orderService.settleRefund(ctx, {
                    id: refund.id,
                    transactionId: (_b = refund.transactionId) !== null && _b !== void 0 ? _b : '',
                });
                refund.state = settled.state;
            }
            if (refund.state === 'Settled') {
                request.refundTransactionId = refund.transactionId || null;
                request.actualRefundAmount = refund.total != null ? Number(refund.total) : request.refundAmount;
                request.refundError = null;
                request.refundedAt = new Date();
                request.state = 'Refunded';
                await repo.save(request);
                await this.updateOrderAfterSalesStatus(ctx, request.orderId, 'Refunded');
                core_1.Logger.info(`Refund settled for after-sales request #${request.id}, tx=${request.refundTransactionId}`, constants_1.loggerCtx);
            }
            else {
                // Failed 等非成功终态：不抛（调用方可进入 RefundFailed 重试），仅告警与留痕
                request.state = 'RefundFailed';
                request.refundError = `退款未达 Settled，当前 ${refund.state}`;
                request.refundedAt = undefined;
                await repo.save(request);
                await this.updateOrderAfterSalesStatus(ctx, request.orderId, 'RefundFailed');
                core_1.Logger.warn(`after-sales #${request.id} 退款终态 ${refund.state}，已置 RefundFailed`, constants_1.loggerCtx);
            }
            await this.connection.commitOpenTransaction(ctx);
        }
        catch (e) {
            await this.connection.rollBackTransaction(ctx);
            if (e instanceof core_1.UserInputError && String(e.message).includes('refundOrder')) {
                // refundOrder 拒绝已留痕 RefundFailed，这里直接抛给调用方
                throw e;
            }
            core_1.Logger.error(`Refund failed for after-sales #${request.id}: ${e.message}`, constants_1.loggerCtx);
            // 未知异常：置 RefundFailed 以便重试，而非让事务留下半成品
            await this.applyRefundFailed(ctx, request.id, e.message, false);
            throw e;
        }
        return this.hydrate(ctx, request.id);
    }
    /** 幂等地把售后单置为 RefundFailed（不入事务，供 catch 兜底），避免异常路径留下半成品脏数据 */
    async applyRefundFailed(ctx, idOrRequest, error, inTx) {
        var _a;
        try {
            const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
            const request = typeof idOrRequest === 'object' ? idOrRequest : await repo.findOne({ where: { id: idOrRequest } });
            if (!request || request.state === 'Refunded')
                return;
            request.state = 'RefundFailed';
            request.refundError = error;
            request.refundedAt = undefined;
            await repo.save(request);
            await this.updateOrderAfterSalesStatus(ctx, request.orderId, 'RefundFailed');
        }
        catch (inner) {
            core_1.Logger.error(`applyRefundFailed 兜底写入失败: ${(_a = inner === null || inner === void 0 ? void 0 : inner.message) !== null && _a !== void 0 ? _a : inner}`, constants_1.loggerCtx);
        }
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