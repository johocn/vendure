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
exports.SubscribeMessageService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const subscribe_message_log_entity_1 = require("./subscribe-message-log.entity");
let SubscribeMessageService = class SubscribeMessageService {
    constructor(connection, listQueryBuilder, provider, options) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.provider = provider;
        this.options = options;
    }
    // ===== 业务入口 =====
    async sendOrderPaidMessage(ctx, order) {
        const templateId = this.getChannelTemplateId(ctx, 'orderPaidTemplateId');
        if (!templateId) {
            core_1.Logger.debug(`Channel ${ctx.channelId} has no orderPaidTemplateId, skip`, constants_1.loggerCtx);
            return;
        }
        const data = {
            orderNo: { value: String(order.code) },
            totalAmount: { value: this.formatMoney(order.total, ctx) },
            paidAt: { value: this.formatDate(new Date()) },
        };
        await this.dispatchForOrder(ctx, order, templateId, data);
    }
    async sendOrderShippedMessage(ctx, order, fulfillment) {
        var _a, _b;
        const templateId = this.getChannelTemplateId(ctx, 'orderShippedTemplateId');
        if (!templateId) {
            core_1.Logger.debug(`Channel ${ctx.channelId} has no orderShippedTemplateId, skip`, constants_1.loggerCtx);
            return;
        }
        const f = fulfillment !== null && fulfillment !== void 0 ? fulfillment : (await this.getLatestFulfillment(ctx, order));
        const data = {
            orderNo: { value: String(order.code) },
            carrier: { value: (_a = f === null || f === void 0 ? void 0 : f.method) !== null && _a !== void 0 ? _a : '' },
            trackingNo: { value: (_b = f === null || f === void 0 ? void 0 : f.trackingCode) !== null && _b !== void 0 ? _b : '' },
            shippedAt: { value: this.formatDate(new Date()) },
        };
        await this.dispatchForOrder(ctx, order, templateId, data);
    }
    async sendOrderDeliveredMessage(ctx, order) {
        const templateId = this.getChannelTemplateId(ctx, 'orderDeliveredTemplateId');
        if (!templateId) {
            core_1.Logger.debug(`Channel ${ctx.channelId} has no orderDeliveredTemplateId, skip`, constants_1.loggerCtx);
            return;
        }
        const data = {
            orderNo: { value: String(order.code) },
            signedAt: { value: this.formatDate(new Date()) },
        };
        await this.dispatchForOrder(ctx, order, templateId, data);
    }
    async sendOrderRefundedMessage(ctx, order, refund) {
        const templateId = this.getChannelTemplateId(ctx, 'orderRefundedTemplateId');
        if (!templateId) {
            core_1.Logger.debug(`Channel ${ctx.channelId} has no orderRefundedTemplateId, skip`, constants_1.loggerCtx);
            return;
        }
        const data = {
            orderNo: { value: String(order.code) },
            refundAmount: { value: this.formatMoney(refund.total, ctx) },
            refundedAt: { value: this.formatDate(new Date()) },
        };
        await this.dispatchForOrder(ctx, order, templateId, data);
    }
    async sendCustomMessage(ctx, customerId, templateId, data, page) {
        const openid = await this.getOpenidByCustomer(ctx, customerId);
        if (!openid) {
            core_1.Logger.warn(`Customer ${customerId} has no wechat openid, skip`, constants_1.loggerCtx);
            throw new Error(`Customer ${customerId} has no wechat openid`);
        }
        return this.sendAndLog(ctx, Number(customerId), openid, templateId, data, page);
    }
    // ===== Admin 查询 =====
    async getSendLogs(ctx, options) {
        return this.listQueryBuilder
            .build(subscribe_message_log_entity_1.SubscribeMessageLog, options, {
            ctx,
            relations: ['channels'],
            channelId: ctx.channelId,
        })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    // ===== 内部实现 =====
    async dispatchForOrder(ctx, order, templateId, data) {
        var _a;
        const customer = order.customer;
        if (!customer) {
            core_1.Logger.debug(`Order ${order.code} has no customer, skip subscribe message`, constants_1.loggerCtx);
            return;
        }
        const openid = this.readCustomerOpenid(customer);
        if (!openid) {
            core_1.Logger.debug(`Customer ${customer.id} of order ${order.code} has no wechat openid, skip`, constants_1.loggerCtx);
            return;
        }
        try {
            await this.sendAndLog(ctx, Number(customer.id), openid, templateId, data, this.resolvePage(ctx));
        }
        catch (e) {
            core_1.Logger.error(`Failed to send subscribe message for order ${order.code}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
        }
    }
    async sendAndLog(ctx, customerId, openid, templateId, data, page) {
        var _a, _b;
        const miniprogramState = this.resolveMiniprogramState(ctx);
        const log = new subscribe_message_log_entity_1.SubscribeMessageLog({
            customerId,
            openid,
            templateId,
            data,
            status: 'pending',
            page: page !== null && page !== void 0 ? page : null,
            miniprogramState: miniprogramState !== null && miniprogramState !== void 0 ? miniprogramState : null,
        });
        log.channels = [ctx.channel];
        await this.connection.getRepository(ctx, subscribe_message_log_entity_1.SubscribeMessageLog).save(log);
        const input = {
            openid,
            templateId,
            data,
            page: page !== null && page !== void 0 ? page : undefined,
            miniprogramState: miniprogramState !== null && miniprogramState !== void 0 ? miniprogramState : undefined,
        };
        const result = await this.provider.sendSubscribeMessage(ctx, input);
        log.status = result.success ? 'sent' : 'failed';
        log.msgId = (_a = result.msgId) !== null && _a !== void 0 ? _a : null;
        log.errorMsg = (_b = result.error) !== null && _b !== void 0 ? _b : null;
        log.sentAt = result.success ? new Date() : undefined;
        await this.connection.getRepository(ctx, subscribe_message_log_entity_1.SubscribeMessageLog).save(log);
        if (!result.success) {
            core_1.Logger.warn(`Subscribe message to customer ${customerId} (template ${templateId}) failed: ${result.error}`, constants_1.loggerCtx);
        }
        else {
            core_1.Logger.info(`Subscribe message sent to customer ${customerId} (msgid=${result.msgId})`, constants_1.loggerCtx);
        }
        return log;
    }
    async getLatestFulfillment(ctx, order) {
        return this.connection
            .getRepository(ctx, core_1.Fulfillment)
            .createQueryBuilder('f')
            .innerJoin('f.orders', 'order', 'order.id = :orderId', { orderId: order.id })
            .orderBy('f.createdAt', 'DESC')
            .getOne();
    }
    async getOpenidByCustomer(ctx, customerId) {
        const customer = await this.connection
            .getEntityOrThrow(ctx, core_1.Customer, customerId)
            .catch(() => null);
        if (!customer)
            return null;
        return this.readCustomerOpenid(customer);
    }
    readCustomerOpenid(customer) {
        var _a;
        const cf = (_a = customer === null || customer === void 0 ? void 0 : customer.customFields) !== null && _a !== void 0 ? _a : {};
        return cf.wechatMiniOpenid || cf.wechatOpenid || null;
    }
    getChannelTemplateId(ctx, field) {
        var _a, _b, _c;
        const cf = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) !== null && _b !== void 0 ? _b : {};
        return (_c = cf[field]) !== null && _c !== void 0 ? _c : null;
    }
    resolvePage(ctx) {
        var _a, _b, _c, _d;
        const cf = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) !== null && _b !== void 0 ? _b : {};
        return (_d = (_c = cf.subscribeMessagePage) !== null && _c !== void 0 ? _c : this.options.defaultPage) !== null && _d !== void 0 ? _d : undefined;
    }
    resolveMiniprogramState(ctx) {
        var _a, _b, _c, _d;
        const cf = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) !== null && _b !== void 0 ? _b : {};
        return ((_d = (_c = cf.subscribeMessageMiniprogramState) !== null && _c !== void 0 ? _c : this.options.defaultMiniprogramState) !== null && _d !== void 0 ? _d : 'formal');
    }
    formatMoney(amount, ctx) {
        var _a;
        const value = (amount !== null && amount !== void 0 ? amount : 0) / 100;
        const currency = (_a = ctx.currencyCode) !== null && _a !== void 0 ? _a : 'CNY';
        const symbol = currency === 'CNY' ? '¥' : '';
        return `${symbol}${value.toFixed(2)}`;
    }
    formatDate(date) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }
};
exports.SubscribeMessageService = SubscribeMessageService;
exports.SubscribeMessageService = SubscribeMessageService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(constants_1.WECHAT_MESSAGE_PROVIDER)),
    __param(3, (0, common_1.Inject)(constants_1.SUBSCRIBE_MESSAGE_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder, Object, Object])
], SubscribeMessageService);
//# sourceMappingURL=subscribe-message.service.js.map