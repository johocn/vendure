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
exports.InvoiceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const invoice_entity_1 = require("./invoice.entity");
const invoice_provider_1 = require("./invoice-provider");
let InvoiceService = class InvoiceService {
    constructor(connection, listQueryBuilder) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.orderService = null;
        this.options = {};
        this.provider = new invoice_provider_1.NoopInvoiceProvider();
    }
    init(injector) {
        var _a, _b;
        this.orderService = injector.get(core_1.OrderService);
        try {
            this.options = (_a = injector.get(constants_1.INVOICE_PLUGIN_OPTIONS)) !== null && _a !== void 0 ? _a : {};
        }
        catch (_c) {
            this.options = {};
        }
        this.provider = (_b = this.options.provider) !== null && _b !== void 0 ? _b : new invoice_provider_1.NoopInvoiceProvider();
        core_1.Logger.info(`InvoiceService initialized with provider: ${this.provider.config.code}`, constants_1.loggerCtx);
    }
    async getInvoice(ctx, id) {
        const repo = this.connection.getRepository(ctx, invoice_entity_1.Invoice);
        const result = await repo.findOne({
            where: { id: id },
            relations: { channels: true },
        });
        return result !== null && result !== void 0 ? result : undefined;
    }
    async getInvoices(ctx, options) {
        return this.listQueryBuilder
            .build(invoice_entity_1.Invoice, options, {
            ctx,
            relations: ['channels'],
            channelId: ctx.channelId,
        })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    async getMyInvoices(ctx) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const repo = this.connection.getRepository(ctx, invoice_entity_1.Invoice);
        return repo.find({
            where: { customerId: ctx.activeUserId },
            relations: { channels: true },
        });
    }
    async getMyInvoice(ctx, id) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const repo = this.connection.getRepository(ctx, invoice_entity_1.Invoice);
        const result = await repo.findOne({
            where: { id: id, customerId: ctx.activeUserId },
            relations: { channels: true },
        });
        return result !== null && result !== void 0 ? result : undefined;
    }
    async createInvoice(ctx, input) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        if (!this.orderService) {
            throw new Error('OrderService not initialized');
        }
        if (!input.orderIds || input.orderIds.length === 0) {
            throw new core_1.UserInputError('orderIds must not be empty');
        }
        if (!input.title) {
            throw new core_1.UserInputError('title must not be empty');
        }
        // 1. 校验订单归属 + 状态，累计订单实付金额
        let totalPaid = 0;
        for (const orderId of input.orderIds) {
            const order = await this.orderService.findOne(ctx, orderId, ['customer']);
            if (!order) {
                throw new core_1.UserInputError(`Order ${orderId} not found`);
            }
            if (!order.customer || String(order.customer.id) !== String(ctx.activeUserId)) {
                throw new core_1.ForbiddenError();
            }
            const allowedStates = ['Delivered', 'Completed', 'PartialDelivery'];
            if (!allowedStates.includes(order.state)) {
                throw new core_1.UserInputError(`Order ${orderId} state must be one of ${allowedStates.join('/')}, got ${order.state}`);
            }
            totalPaid += ((_a = order.total) !== null && _a !== void 0 ? _a : 0);
        }
        // 2. 重复开票校验（任一 orderId 已有 PENDING/ISSUED 发票）
        const repo = this.connection.getRepository(ctx, invoice_entity_1.Invoice);
        const existing = await repo.find({
            where: {
                customerId: ctx.activeUserId,
                status: (0, typeorm_1.Not)((0, typeorm_1.In)([invoice_entity_1.InvoiceStatus.REVERSED, invoice_entity_1.InvoiceStatus.FAILED])),
            },
        });
        const orderIdSet = new Set(input.orderIds.map(id => String(id)));
        for (const inv of existing) {
            const overlap = (inv.orderIds || []).some(oid => orderIdSet.has(String(oid)));
            if (overlap) {
                throw new core_1.UserInputError(`Invoice already exists for one of orderIds (invoice #${inv.id})`);
            }
        }
        // 3. 金额上限校验（开票金额 ≤ 订单实付金额合计）
        const amount = (_b = input.amount) !== null && _b !== void 0 ? _b : totalPaid;
        if (amount > totalPaid) {
            throw new core_1.UserInputError(`Invoice amount ${amount} exceeds orders total ${totalPaid}`);
        }
        // 4. 创建 Invoice 记录
        const invoice = new invoice_entity_1.Invoice({
            invoiceType: input.invoiceType,
            status: invoice_entity_1.InvoiceStatus.PENDING,
            title: input.title,
            taxNumber: (_c = input.taxNumber) !== null && _c !== void 0 ? _c : null,
            email: (_d = input.email) !== null && _d !== void 0 ? _d : null,
            companyAddress: (_e = input.companyAddress) !== null && _e !== void 0 ? _e : null,
            companyPhone: (_f = input.companyPhone) !== null && _f !== void 0 ? _f : null,
            bankName: (_g = input.bankName) !== null && _g !== void 0 ? _g : null,
            bankAccount: (_h = input.bankAccount) !== null && _h !== void 0 ? _h : null,
            amount,
            customerId: ctx.activeUserId,
            orderIds: input.orderIds.map(id => Number(id)),
        });
        invoice.channels = [ctx.channel];
        const saved = await repo.save(invoice);
        core_1.Logger.info(`Invoice ${saved.id} created by customer ${ctx.activeUserId}`, constants_1.loggerCtx);
        return saved;
    }
    async issueInvoice(ctx, id) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const repo = this.connection.getRepository(ctx, invoice_entity_1.Invoice);
        const invoice = await repo.findOne({ where: { id: id } });
        if (!invoice) {
            throw new core_1.EntityNotFoundError('Invoice', id);
        }
        if (invoice.status !== invoice_entity_1.InvoiceStatus.PENDING) {
            throw new core_1.UserInputError(`Invoice status must be PENDING, got ${invoice.status}`);
        }
        try {
            const result = await this.provider.issue(ctx, {
                invoiceType: invoice.invoiceType,
                title: invoice.title,
                taxNumber: (_a = invoice.taxNumber) !== null && _a !== void 0 ? _a : undefined,
                email: (_b = invoice.email) !== null && _b !== void 0 ? _b : undefined,
                companyAddress: (_c = invoice.companyAddress) !== null && _c !== void 0 ? _c : undefined,
                companyPhone: (_d = invoice.companyPhone) !== null && _d !== void 0 ? _d : undefined,
                bankName: (_e = invoice.bankName) !== null && _e !== void 0 ? _e : undefined,
                bankAccount: (_f = invoice.bankAccount) !== null && _f !== void 0 ? _f : undefined,
                amount: invoice.amount,
                orderIds: invoice.orderIds,
            });
            if (result.success) {
                invoice.status = invoice_entity_1.InvoiceStatus.ISSUED;
                invoice.providerInvoiceNo = (_g = result.invoiceNo) !== null && _g !== void 0 ? _g : null;
                invoice.pdfUrl = (_h = result.pdfUrl) !== null && _h !== void 0 ? _h : null;
                invoice.issuedAt = new Date();
                invoice.lastError = null;
            }
            else {
                invoice.status = invoice_entity_1.InvoiceStatus.FAILED;
                invoice.lastError = (_j = result.error) !== null && _j !== void 0 ? _j : 'Unknown error';
            }
            await repo.save(invoice);
        }
        catch (e) {
            invoice.status = invoice_entity_1.InvoiceStatus.FAILED;
            invoice.lastError = e.message;
            await repo.save(invoice);
            core_1.Logger.error(`Issue invoice ${id} failed: ${e.message}`, constants_1.loggerCtx);
            throw e;
        }
        return invoice;
    }
    async reverseInvoice(ctx, id, reason) {
        var _a;
        const repo = this.connection.getRepository(ctx, invoice_entity_1.Invoice);
        const invoice = await repo.findOne({ where: { id: id } });
        if (!invoice) {
            throw new core_1.EntityNotFoundError('Invoice', id);
        }
        if (invoice.status !== invoice_entity_1.InvoiceStatus.ISSUED) {
            throw new core_1.UserInputError(`Invoice status must be ISSUED, got ${invoice.status}`);
        }
        if (!invoice.providerInvoiceNo) {
            throw new core_1.UserInputError('Invoice has no providerInvoiceNo to reverse');
        }
        try {
            const result = await this.provider.reverse(ctx, invoice.providerInvoiceNo, reason);
            if (result.success) {
                invoice.status = invoice_entity_1.InvoiceStatus.REVERSED;
                invoice.reverseReason = reason;
                invoice.reversedAt = new Date();
                invoice.lastError = null;
            }
            else {
                invoice.lastError = (_a = result.error) !== null && _a !== void 0 ? _a : 'Unknown error';
            }
            await repo.save(invoice);
        }
        catch (e) {
            invoice.lastError = e.message;
            await repo.save(invoice);
            core_1.Logger.error(`Reverse invoice ${id} failed: ${e.message}`, constants_1.loggerCtx);
            throw e;
        }
        return invoice;
    }
    async downloadPdf(ctx, id) {
        const repo = this.connection.getRepository(ctx, invoice_entity_1.Invoice);
        const invoice = await repo.findOne({ where: { id: id } });
        if (!invoice) {
            throw new core_1.EntityNotFoundError('Invoice', id);
        }
        if (invoice.status !== invoice_entity_1.InvoiceStatus.ISSUED) {
            throw new core_1.UserInputError(`Invoice status must be ISSUED, got ${invoice.status}`);
        }
        if (!invoice.pdfUrl && invoice.providerInvoiceNo) {
            const result = await this.provider.queryPdf(ctx, invoice.providerInvoiceNo);
            if (result.pdfUrl) {
                invoice.pdfUrl = result.pdfUrl;
                await repo.save(invoice);
            }
            else if (result.error) {
                invoice.lastError = result.error;
                await repo.save(invoice);
            }
        }
        return invoice;
    }
};
exports.InvoiceService = InvoiceService;
exports.InvoiceService = InvoiceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder])
], InvoiceService);
//# sourceMappingURL=invoice.service.js.map