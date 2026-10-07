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
var AfterSalesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AfterSalesService = void 0;
const common_1 = require("@nestjs/common");
const node_stream_1 = require("node:stream");
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const after_sales_request_entity_1 = require("./after-sales-request.entity");
const after_sales_message_entity_1 = require("./after-sales-message.entity");
const after_sales_state_history_entity_1 = require("./after-sales-state-history.entity");
const after_sales_events_1 = require("./after-sales.events");
const types_1 = require("./types");
const inventory_plugin_1 = require("@vendure/inventory-plugin");
let AfterSalesService = AfterSalesService_1 = class AfterSalesService {
    constructor(connection, listQueryBuilder) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.orderService = null;
        this.customerService = null;
        this.inventoryService = null;
        this.options = {};
        this.assetService = null;
        this.configService = null;
        this.channelService = null;
        this.eventBus = null;
    }
    init(injector) {
        var _a, _b;
        this.orderService = injector.get(core_1.OrderService);
        this.customerService = injector.get(core_1.CustomerService);
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
        this.assetService = injector.get(core_1.AssetService);
        this.configService = injector.get(core_1.ConfigService);
        try {
            this.channelService = injector.get(core_1.ChannelService);
        }
        catch (_d) {
            this.channelService = null;
        }
        try {
            this.eventBus = injector.get(core_1.EventBus);
        }
        catch (_e) {
            this.eventBus = null;
        }
    }
    /**
     * 当前登录用户对应的 Customer 主键。
     * 说明：ctx.activeUserId 是 User 表主键，而售后单 customerId 存的是 Customer 表主键，
     * 两者是不同实体，必须经 CustomerService.findOneByUserId 桥接，否则过滤永远匹配不到。
     */
    async resolveCustomerId(ctx) {
        if (!ctx.activeUserId || !this.customerService)
            return null;
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        return customer ? Number(customer.id) : null;
    }
    async findOne(ctx, id) {
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const result = await repo.findOne({
            where: { id: id },
            relations: { order: true, orderLine: true, customer: true, channels: true, history: true },
            order: { history: { createdAt: 'ASC' } },
        });
        return result !== null && result !== void 0 ? result : undefined;
    }
    /**
     * Shop API 专用：按 customer 过滤，防止越权枚举他人售后单。
     */
    async findOneForCustomer(ctx, id) {
        const customerId = await this.resolveCustomerId(ctx);
        if (!customerId) {
            throw new core_1.UnauthorizedError();
        }
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const result = await repo.findOne({
            where: { id: id, customerId },
            relations: { order: true, orderLine: true, channels: true, history: true },
            order: { history: { createdAt: 'ASC' } },
        });
        if (result) {
            await this.attachMessageCounts(ctx, [result]);
        }
        return result !== null && result !== void 0 ? result : undefined;
    }
    async findMyRequests(ctx, options) {
        const customerId = await this.resolveCustomerId(ctx);
        if (!customerId) {
            return { items: [], totalItems: 0 };
        }
        return this.listQueryBuilder
            .build(after_sales_request_entity_1.AfterSalesRequest, options, {
            ctx,
            relations: ['order', 'orderLine', 'channels'],
            channelId: ctx.channelId,
        })
            .andWhere('aftersalesrequest."customerId" = :customerId', { customerId })
            .getManyAndCount()
            .then(async ([items, totalItems]) => {
            await this.attachMessageCounts(ctx, items);
            return { items, totalItems };
        });
    }
    async findAll(ctx, options) {
        return this.listQueryBuilder
            .build(after_sales_request_entity_1.AfterSalesRequest, options, {
            ctx,
            relations: ['order', 'orderLine', 'customer', 'channels'],
            channelId: ctx.channelId,
        })
            .getManyAndCount()
            .then(async ([items, totalItems]) => {
            await this.attachMessageCounts(ctx, items);
            return { items, totalItems };
        });
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
            reason: input.reason,
            description: input.description || null,
            evidenceImages: input.evidenceImages || null,
            refundAmount: input.refundAmount,
            customerId: order.customer.id,
        });
        request.channels = [ctx.channel];
        const saved = await this.commitState(ctx, request, null, 'Pending');
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
        const fromState = request.state;
        const saved = await this.commitState(ctx, request, fromState, 'Closed');
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
        const fromState = request.state;
        request.returnTrackingNo = trackingNo;
        request.returnCarrier = carrier;
        const saved = await this.commitState(ctx, request, fromState, 'Returning');
        return this.hydrate(ctx, saved.id);
    }
    /**
     * 顾客端上传售后凭证图。
     * 仅做「边界校验 + 落 Asset」，不创建售后单、不写售后业务数据。
     * 返回绝对值 URL：AssetInterceptorPlugin 只对 GraphQL 类型为 Asset 的字段补绝对前缀，
     * 这里是 [String!]!，必须自行调用 storageStrategy.toAbsoluteUrl（与 Vendure 自身行为一致）。
     */
    async uploadEvidence(ctx, images) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        if (!Array.isArray(images) || images.length === 0) {
            throw new core_1.UserInputError('No evidence image provided');
        }
        if (!this.assetService || !this.configService) {
            throw new Error('AssetService not initialized');
        }
        const urls = [];
        for (const dataUrl of images) {
            const parsed = AfterSalesService_1.parseImageDataUrl(dataUrl);
            if (!parsed) {
                throw new core_1.UserInputError('Invalid evidence image: only png/jpeg/webp data URL is allowed');
            }
            if (parsed.buffer.length > AfterSalesService_1.EVIDENCE_MAX_BYTES) {
                throw new core_1.UserInputError(`Evidence image too large: ${parsed.buffer.length} bytes exceeds ${AfterSalesService_1.EVIDENCE_MAX_BYTES} bytes`);
            }
            const filename = `after-sales-evidence-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${parsed.ext}`;
            const asset = await this.assetService.createFromFileStream(node_stream_1.Readable.from(parsed.buffer), filename, ctx);
            if ((0, core_1.isGraphQlErrorResult)(asset)) {
                throw new core_1.UserInputError(`Failed to create asset: ${asset.message}`);
            }
            urls.push(this.toAbsoluteAssetUrl(ctx, asset.preview));
        }
        core_1.Logger.info(`Uploaded ${urls.length} after-sales evidence image(s) by user ${ctx.activeUserId}`, constants_1.loggerCtx);
        return urls;
    }
    /** 解析 `data:image/(png|jpeg|webp);base64,xxx`，非法返回 null */
    static parseImageDataUrl(dataUrl) {
        if (typeof dataUrl !== 'string')
            return null;
        const match = /^data:(image\/[a-z+.-]+);base64,([\s\S]+)$/i.exec(dataUrl.trim());
        if (!match)
            return null;
        const mime = match[1].toLowerCase();
        const ext = AfterSalesService_1.EVIDENCE_MIME_EXT[mime];
        if (!ext)
            return null;
        try {
            const buffer = Buffer.from(match[2], 'base64');
            if (buffer.length === 0)
                return null;
            return { buffer, ext };
        }
        catch (_a) {
            return null;
        }
    }
    /** 与 AssetInterceptorPlugin 同源：用 assetStorageStrategy.toAbsoluteUrl 补绝对前缀 */
    toAbsoluteAssetUrl(ctx, preview) {
        var _a;
        if (!preview)
            return '';
        const strategy = (_a = this.configService) === null || _a === void 0 ? void 0 : _a.assetOptions.assetStorageStrategy;
        if ((strategy === null || strategy === void 0 ? void 0 : strategy.toAbsoluteUrl) && ctx.req) {
            return strategy.toAbsoluteUrl(ctx.req, preview);
        }
        return preview;
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
            relations: { order: true, orderLine: true, channels: true, history: true },
            order: { history: { createdAt: 'ASC' } },
        });
        if (full) {
            await this.attachMessageCounts(ctx, [full]);
            return full;
        }
        throw new Error(`AfterSalesRequest #${id} not found after save`);
    }
    /**
     * 状态变更统一出口：写状态 + 落历史 + 发布 AfterSalesStateTransitionEvent。
     * 所有状态写入点必须经此方法保证通知全覆盖；事件发布失败仅告警不阻断。
     */
    async commitState(ctx, request, fromState, toState) {
        var _a, _b, _c, _d;
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        request.state = toState;
        const saved = await repo.save(request);
        await this.recordState(ctx, Number(saved.id), fromState, toState);
        try {
            const full = await repo.findOne({ where: { id: saved.id }, relations: { order: true } });
            await ((_a = this.eventBus) === null || _a === void 0 ? void 0 : _a.publish(new after_sales_events_1.AfterSalesStateTransitionEvent(ctx, Number(saved.id), Number(saved.orderId), saved.type, fromState, toState, saved.customerId != null ? Number(saved.customerId) : null, (_c = (_b = full === null || full === void 0 ? void 0 : full.order) === null || _b === void 0 ? void 0 : _b.code) !== null && _c !== void 0 ? _c : null, new Date())));
        }
        catch (e) {
            core_1.Logger.warn(`publish AfterSalesStateTransitionEvent failed for #${saved.id}: ${(_d = e === null || e === void 0 ? void 0 : e.message) !== null && _d !== void 0 ? _d : e}`, constants_1.loggerCtx);
        }
        return saved;
    }
    /** 状态流转历史落库：失败仅告警，绝不阻断主流程 */
    async recordState(ctx, requestId, fromState, toState) {
        var _a;
        try {
            const repo = this.connection.getRepository(ctx, after_sales_state_history_entity_1.AfterSalesStateHistory);
            await repo.insert({
                requestId,
                fromState: fromState !== null && fromState !== void 0 ? fromState : null,
                toState,
                operatorUserId: ctx.activeUserId != null ? Number(ctx.activeUserId) : null,
            });
        }
        catch (e) {
            core_1.Logger.warn(`recordState failed for after-sales #${requestId}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
        }
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
        const fromState = request.state;
        request.rejectReason = reason;
        const saved = await this.commitState(ctx, request, fromState, 'Rejected');
        return this.hydrate(ctx, saved.id);
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
            const fromState = request.state;
            const saved = await this.commitState(txCtx, request, fromState, 'Received');
            return this.hydrate(txCtx, saved.id);
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
        if (request.type === 'exchange') {
            throw new core_1.UserInputError('Cannot refund: exchange requests are not refundable');
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
        const fromState = request.state;
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
                request.refundError = `refundOrder 拒绝: ${JSON.stringify(refundResult)}`;
                request.refundedAt = undefined;
                await this.commitState(ctx, request, fromState, 'RefundFailed');
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
                await this.commitState(ctx, request, fromState, 'Refunded');
                await this.updateOrderAfterSalesStatus(ctx, request.orderId, 'Refunded');
                core_1.Logger.info(`Refund settled for after-sales request #${request.id}, tx=${request.refundTransactionId}`, constants_1.loggerCtx);
            }
            else {
                // Failed 等非成功终态：不抛（调用方可进入 RefundFailed 重试），仅告警与留痕
                request.refundError = `退款未达 Settled，当前 ${refund.state}`;
                request.refundedAt = undefined;
                await this.commitState(ctx, request, fromState, 'RefundFailed');
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
            const fromState = request.state;
            request.refundError = error;
            request.refundedAt = undefined;
            if (fromState !== 'RefundFailed') {
                await this.commitState(ctx, request, fromState, 'RefundFailed');
            }
            else {
                // 已是 RefundFailed 的重复兜底：只更新错误信息，不再发布事件（防重试风暴）
                await repo.save(request);
            }
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
    /** Admin 单查：加载 order/orderLine/customer/history（web-admin 详情页专用，替代列表过滤 hack） */
    async findOneForAdmin(ctx, id) {
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const result = await repo.findOne({
            where: { id: id },
            relations: { order: true, orderLine: true, customer: true, channels: true, history: true },
            order: { history: { createdAt: 'ASC' } },
        });
        if (result) {
            await this.attachMessageCounts(ctx, [result]);
        }
        return result !== null && result !== void 0 ? result : undefined;
    }
    /** 批量同意：复用单条方法逐条执行，单条失败不中断整批。上限 50。 */
    async batchApprove(ctx, ids) {
        var _a;
        if (!Array.isArray(ids) || ids.length === 0)
            throw new core_1.UserInputError('ids is required');
        if (ids.length > 50)
            throw new core_1.UserInputError(`Batch limit is 50, got ${ids.length}`);
        const results = [];
        for (const id of ids) {
            try {
                const r = await this.approveRequest(ctx, id);
                results.push({ id: String(id), success: true, state: r.state, message: '' });
            }
            catch (e) {
                results.push({ id: String(id), success: false, state: '', message: (_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : String(e) });
            }
        }
        return results;
    }
    /** 批量拒绝：同 batchApprove，整批共用一个 reason。 */
    async batchReject(ctx, ids, reason) {
        var _a;
        if (!Array.isArray(ids) || ids.length === 0)
            throw new core_1.UserInputError('ids is required');
        if (ids.length > 50)
            throw new core_1.UserInputError(`Batch limit is 50, got ${ids.length}`);
        const results = [];
        for (const id of ids) {
            try {
                const r = await this.rejectRequest(ctx, id, reason);
                results.push({ id: String(id), success: true, state: r.state, message: '' });
            }
            catch (e) {
                results.push({ id: String(id), success: false, state: '', message: (_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : String(e) });
            }
        }
        return results;
    }
    /** 读当前渠道售后寄回地址（Admin/Shop 共用；未配置返回空串） */
    async getReturnAddress(ctx) {
        var _a, _b;
        const repo = this.connection.getRepository(ctx, core_1.Channel);
        const channel = await repo.findOne({ where: { id: ctx.channelId } });
        return (_b = (_a = channel === null || channel === void 0 ? void 0 : channel.customFields) === null || _a === void 0 ? void 0 : _a.afterSalesReturnAddress) !== null && _b !== void 0 ? _b : '';
    }
    /** 写当前渠道售后寄回地址（走 ChannelService.update，免开 ChannelService 权限） */
    async updateReturnAddress(ctx, address) {
        if (!this.channelService)
            throw new Error('ChannelService not initialized');
        await this.channelService.update(ctx, {
            id: ctx.channelId,
            customFields: { afterSalesReturnAddress: address },
        });
        return true;
    }
    /**
     * 售后数据看板聚合（三期设计 §四）：窗口申请总数 / 仍 Pending / 实退总额 / 平均处理时长 / 按日 / 按状态 / 按类型。
     * from/to 接受 'YYYY-MM-DD' 或完整 ISO 串（纯日期的 to 按当日 23:59:59.999 收口）。
     * 分日聚合用 SUBSTR(createdAt,1,10)（sqlite/mysql 均支持）；平均处理时长用 JS 计算避免跨库 AVG 精度差异。
     */
    async stats(ctx, from, to) {
        var _a;
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            throw new core_1.UserInputError('Invalid from/to date');
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(to).trim())) {
            toDate.setHours(23, 59, 59, 999);
        }
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const totalRequests = await repo
            .createQueryBuilder('r')
            .where('r.createdAt >= :from', { from: fromDate })
            .andWhere('r.createdAt <= :to', { to: toDate })
            .getCount();
        const pendingCount = await repo
            .createQueryBuilder('r')
            .where('r.state = :state', { state: 'Pending' })
            .andWhere('r.createdAt <= :to', { to: toDate })
            .getCount();
        const refundRow = await repo
            .createQueryBuilder('r')
            .select('COALESCE(SUM(r.actualRefundAmount), 0)', 'total')
            .where("r.state = 'Refunded'")
            .andWhere('r.refundedAt >= :from', { from: fromDate })
            .andWhere('r.refundedAt <= :to', { to: toDate })
            .getRawOne();
        const totalRefundAmount = Number((_a = refundRow === null || refundRow === void 0 ? void 0 : refundRow.total) !== null && _a !== void 0 ? _a : 0);
        const dailyRows = await repo
            .createQueryBuilder('r')
            .select('SUBSTR(r.createdAt, 1, 10)', 'date')
            .addSelect('COUNT(*)', 'total')
            .where('r.createdAt >= :from', { from: fromDate })
            .andWhere('r.createdAt <= :to', { to: toDate })
            .groupBy('SUBSTR(r.createdAt, 1, 10)')
            .orderBy('SUBSTR(r.createdAt, 1, 10)', 'ASC')
            .getRawMany();
        const stateRows = await repo
            .createQueryBuilder('r')
            .select('r.state', 'key')
            .addSelect('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(r.actualRefundAmount), 0)', 'amount')
            .where('r.createdAt >= :from', { from: fromDate })
            .andWhere('r.createdAt <= :to', { to: toDate })
            .groupBy('r.state')
            .getRawMany();
        const typeRows = await repo
            .createQueryBuilder('r')
            .select('r.type', 'key')
            .addSelect('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(r.actualRefundAmount), 0)', 'amount')
            .where('r.createdAt >= :from', { from: fromDate })
            .andWhere('r.createdAt <= :to', { to: toDate })
            .groupBy('r.type')
            .getRawMany();
        // 平均处理时长（小时）：窗口内 Refunded 行 refundedAt - createdAt 的均值，保留两位；无数据为 null
        const refunded = await repo.find({ where: { state: 'Refunded' } });
        const hours = refunded
            .filter((r) => r.refundedAt &&
            new Date(r.createdAt) >= fromDate &&
            new Date(r.createdAt) <= toDate)
            .map((r) => (r.refundedAt.getTime() - new Date(r.createdAt).getTime()) / 3600000)
            .filter((h) => h >= 0);
        const avgHandleHours = hours.length
            ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 100) / 100
            : null;
        return {
            totalRequests,
            pendingCount,
            totalRefundAmount,
            avgHandleHours,
            daily: dailyRows.map((row) => ({ date: String(row.date), total: Number(row.total) })),
            byState: stateRows.map((row) => ({
                key: String(row.key),
                count: Number(row.count),
                amount: Number(row.amount),
            })),
            byType: typeRows.map((row) => ({
                key: String(row.key),
                count: Number(row.count),
                amount: Number(row.amount),
            })),
        };
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
        const saved = await this.commitState(ctx, request, request.state, toState);
        return this.hydrate(ctx, saved.id);
    }
    /**
     * 追加一条协商留言。senderType=customer 供顾客发送（addAfterSalesMessage），admin 供商家回复（replyAfterSalesMessage）。
     * 售后单关闭（Closed）后禁止继续留言；图片 ≤3 张、正文 ≤1000 字。
     */
    async addMessage(ctx, requestId, senderType, content, images) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const request = await repo.findOne({ where: { id: requestId } });
        if (!request)
            throw new core_1.UserInputError(`After-sales request ${requestId} not found`);
        if (request.state === 'Closed') {
            // ForbiddenError 是 I18nError，自定义文案会被丢弃，故用 UserInputError 透传禁言提示
            throw new core_1.UserInputError('After-sales request is closed: messaging disabled');
        }
        const trimmed = (content !== null && content !== void 0 ? content : '').trim();
        if (!trimmed) {
            throw new core_1.UserInputError('Message content is required');
        }
        if (trimmed.length > AfterSalesService_1.MESSAGE_MAX_LENGTH) {
            throw new core_1.UserInputError(`Message content exceeds ${AfterSalesService_1.MESSAGE_MAX_LENGTH} characters`);
        }
        const imgs = Array.isArray(images) ? images : [];
        if (imgs.length > AfterSalesService_1.MESSAGE_MAX_IMAGES) {
            throw new core_1.UserInputError(`Message images exceed limit of ${AfterSalesService_1.MESSAGE_MAX_IMAGES}`);
        }
        const senderName = await this.resolveSenderName(ctx, senderType);
        const msgRepo = this.connection.getRepository(ctx, after_sales_message_entity_1.AfterSalesMessage);
        const message = await msgRepo.save(new after_sales_message_entity_1.AfterSalesMessage({
            requestId: Number(requestId),
            senderType,
            senderUserId: Number(ctx.activeUserId),
            senderName,
            content: trimmed,
            images: imgs.length ? imgs : null,
        }));
        core_1.Logger.info(`After-sales message added: request=${requestId} sender=${senderType} user=${ctx.activeUserId}`, constants_1.loggerCtx);
        return message;
    }
    /** 发送人显示名：管理员取 Administrator、顾客取 Customer（姓名拼接），失败兜底 'user' */
    async resolveSenderName(ctx, senderType) {
        var _a;
        if (!ctx.activeUserId)
            return 'user';
        try {
            if (senderType === 'admin') {
                const adminRepo = this.connection.getRepository(ctx, core_1.Administrator);
                const admin = await adminRepo.findOne({
                    where: { user: { id: ctx.activeUserId } },
                    relations: { user: true },
                });
                if (admin)
                    return `${admin.firstName} ${admin.lastName}`.trim();
            }
            else if (this.customerService) {
                const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
                if (customer)
                    return `${customer.firstName} ${customer.lastName}`.trim();
            }
        }
        catch (e) {
            core_1.Logger.warn(`resolveSenderName failed: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
        }
        return 'user';
    }
    /**
     * 售后单留言列表（createdAt 正序，skip/take 常规分页）。
     * senderType=customer 时校验售后单归属当前顾客，防止越权读他人留言。
     */
    async listMessages(ctx, requestId, senderType, options) {
        var _a, _b;
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const request = await repo.findOne({ where: { id: requestId } });
        if (!request)
            throw new core_1.UserInputError(`After-sales request ${requestId} not found`);
        if (senderType === 'customer') {
            const customerId = await this.resolveCustomerId(ctx);
            if (!customerId || Number(request.customerId) !== customerId) {
                throw new core_1.ForbiddenError();
            }
        }
        const msgRepo = this.connection.getRepository(ctx, after_sales_message_entity_1.AfterSalesMessage);
        const take = Math.min(Math.max((_a = options === null || options === void 0 ? void 0 : options.take) !== null && _a !== void 0 ? _a : 50, 1), 100);
        const skip = Math.max((_b = options === null || options === void 0 ? void 0 : options.skip) !== null && _b !== void 0 ? _b : 0, 0);
        const [items, totalItems] = await msgRepo.findAndCount({
            where: { requestId: Number(requestId) },
            order: { createdAt: 'ASC' },
            skip,
            take,
        });
        return { items, totalItems };
    }
    /** 批量统计各售后单留言条数并附加到 messageCount 非持久化属性 */
    async attachMessageCounts(ctx, requests) {
        var _a;
        if (!requests.length)
            return;
        const ids = requests.map((r) => Number(r.id));
        const msgRepo = this.connection.getRepository(ctx, after_sales_message_entity_1.AfterSalesMessage);
        const rows = await msgRepo
            .createQueryBuilder('m')
            .select('m.requestId', 'requestId')
            .addSelect('COUNT(*)', 'count')
            .where('m.requestId IN (:...ids)', { ids })
            .groupBy('m.requestId')
            .getRawMany();
        const map = new Map(rows.map((r) => [Number(r.requestId), Number(r.count)]));
        for (const r of requests) {
            r.messageCount = (_a = map.get(Number(r.id))) !== null && _a !== void 0 ? _a : 0;
        }
    }
    // ===== 换货闭环（迭代三期） =====
    /** 换货发货（admin）：Received → ExchangeShipped，仅 exchange 类型、仅 Received 状态可走 */
    async exchangeShip(ctx, id, trackingNo, carrier) {
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id } });
        if (!request)
            throw new core_1.UserInputError(`After-sales request ${id} not found`);
        if (request.type !== 'exchange') {
            throw new core_1.UserInputError('Only exchange requests can be exchange-shipped');
        }
        if (request.state !== 'Received') {
            throw new core_1.UserInputError(`Cannot exchange-ship from state: ${request.state}`);
        }
        request.exchangeTrackingNo = trackingNo;
        request.exchangeCarrier = carrier;
        // commitState 统一出口：落历史 + 发布事件（顾客收「换货已发货」站内信）
        return this.commitState(ctx, request, 'Received', 'ExchangeShipped');
    }
    /** 换货确认收货（shop 顾客）：ExchangeShipped → Closed，需校验售后单归属 */
    async exchangeReceive(ctx, id) {
        const repo = this.connection.getRepository(ctx, after_sales_request_entity_1.AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id } });
        if (!request)
            throw new core_1.UserInputError(`After-sales request ${id} not found`);
        const customerId = await this.resolveCustomerId(ctx);
        if (!customerId || Number(request.customerId) !== customerId) {
            throw new core_1.ForbiddenError();
        }
        if (request.state !== 'ExchangeShipped') {
            throw new core_1.UserInputError(`Cannot exchange-receive from state: ${request.state}`);
        }
        // commitState 统一出口：fromState=ExchangeShipped 的 Closed 事件驱动「换货完成」站内信
        return this.commitState(ctx, request, 'ExchangeShipped', 'Closed');
    }
};
exports.AfterSalesService = AfterSalesService;
/** 凭证图白名单 MIME 及其扩展名（扩展名用于 createFromFileStream 判定 MIME） */
AfterSalesService.EVIDENCE_MIME_EXT = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
};
/** 单张凭证图解码后大小上限（5MB），边界校验，非业务规则 */
AfterSalesService.EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
// ===== 协商留言（迭代三期） =====
AfterSalesService.MESSAGE_MAX_IMAGES = 3;
AfterSalesService.MESSAGE_MAX_LENGTH = 1000;
exports.AfterSalesService = AfterSalesService = AfterSalesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder])
], AfterSalesService);
//# sourceMappingURL=after-sales.service.js.map