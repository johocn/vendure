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
const invoice_title_service_1 = require("./invoice-title.service");
const TAX_ID_PATTERN = /^[0-9A-Z]{15}$|^[0-9A-Z]{17}$|^[0-9A-Z]{18}$|^[0-9A-Z]{20}$/i;
let InvoiceService = class InvoiceService {
    constructor(connection, listQueryBuilder) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.orderService = null;
        this.titleService = null;
        this.options = {};
        this.provider = new invoice_provider_1.NoopInvoiceProvider();
    }
    init(injector) {
        var _a, _b;
        this.orderService = injector.get(core_1.OrderService);
        try {
            this.titleService = injector.get(invoice_title_service_1.InvoiceTitleService);
        }
        catch (e) {
            this.titleService = null;
        }
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
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
        // 0. 合规校验
        this.assertCompliant(input);
        // 0b. 抬头复用：invoiceTitleId 命中后回填抬头快照字段
        const snapshot = Object.assign({}, input);
        if (input.invoiceTitleId) {
            if (!this.titleService) {
                throw new Error('InvoiceTitleService not initialized');
            }
            const title = await this.titleService.getOwned(ctx, input.invoiceTitleId);
            snapshot.title = title.title;
            snapshot.taxNumber = (_a = title.taxNumber) !== null && _a !== void 0 ? _a : undefined;
            snapshot.email = (_b = title.email) !== null && _b !== void 0 ? _b : undefined;
            snapshot.companyAddress = (_c = title.companyAddress) !== null && _c !== void 0 ? _c : undefined;
            snapshot.companyPhone = (_d = title.companyPhone) !== null && _d !== void 0 ? _d : undefined;
            snapshot.bankName = (_e = title.bankName) !== null && _e !== void 0 ? _e : undefined;
            snapshot.bankAccount = (_f = title.bankAccount) !== null && _f !== void 0 ? _f : undefined;
        }
        // 1. 校验订单归属 + 状态，累计订单实付金额
        let totalPaid = 0;
        for (const orderId of input.orderIds) {
            const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user']);
            if (!order) {
                throw new core_1.UserInputError(`Order ${orderId} not found`);
            }
            // order.customer.id 是 Customer 主键，ctx.activeUserId 是关联 User 主键，二者不同；
            // 归属校验基于 customer.user.id 与 activeUserId 比较。
            const customerUserId = (_h = (_g = order.customer) === null || _g === void 0 ? void 0 : _g.user) === null || _h === void 0 ? void 0 : _h.id;
            if (!order.customer || customerUserId == null || String(customerUserId) !== String(ctx.activeUserId)) {
                throw new core_1.ForbiddenError();
            }
            const allowedStates = ['Delivered', 'Completed', 'PartialDelivery'];
            if (!allowedStates.includes(order.state)) {
                throw new core_1.UserInputError(`Order ${orderId} state must be one of ${allowedStates.join('/')}, got ${order.state}`);
            }
            totalPaid += ((_j = order.total) !== null && _j !== void 0 ? _j : 0);
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
        const amount = (_k = snapshot.amount) !== null && _k !== void 0 ? _k : totalPaid;
        if (amount > totalPaid) {
            throw new core_1.UserInputError(`Invoice amount ${amount} exceeds orders total ${totalPaid}`);
        }
        // 4. 创建 Invoice 记录（用快照的抬头字段）
        const invoice = new invoice_entity_1.Invoice({
            invoiceType: snapshot.invoiceType,
            status: invoice_entity_1.InvoiceStatus.PENDING,
            title: snapshot.title,
            taxNumber: (_l = snapshot.taxNumber) !== null && _l !== void 0 ? _l : null,
            email: (_m = snapshot.email) !== null && _m !== void 0 ? _m : null,
            companyAddress: (_o = snapshot.companyAddress) !== null && _o !== void 0 ? _o : null,
            companyPhone: (_p = snapshot.companyPhone) !== null && _p !== void 0 ? _p : null,
            bankName: (_q = snapshot.bankName) !== null && _q !== void 0 ? _q : null,
            bankAccount: (_r = snapshot.bankAccount) !== null && _r !== void 0 ? _r : null,
            amount,
            customerId: ctx.activeUserId,
            channelId: ctx.channelId,
            orderIds: input.orderIds.map(id => Number(id)),
        });
        invoice.channels = [ctx.channel];
        const saved = await repo.save(invoice);
        core_1.Logger.info(`Invoice ${saved.id} created by customer ${ctx.activeUserId}`, constants_1.loggerCtx);
        return saved;
    }
    async issueInvoice(ctx, id) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        const repo = this.connection.getRepository(ctx, invoice_entity_1.Invoice);
        const invoice = await repo.findOne({ where: { id: id } });
        if (!invoice) {
            throw new core_1.EntityNotFoundError('Invoice', id);
        }
        if (invoice.status !== invoice_entity_1.InvoiceStatus.PENDING) {
            throw new core_1.UserInputError(`Invoice status must be PENDING, got ${invoice.status}`);
        }
        // 合规校验：issue 前再次校验（税号格式等）
        this.assertCompliant({
            invoiceType: invoice.invoiceType,
            title: invoice.title,
            taxNumber: (_a = invoice.taxNumber) !== null && _a !== void 0 ? _a : undefined,
            companyAddress: (_b = invoice.companyAddress) !== null && _b !== void 0 ? _b : undefined,
            companyPhone: (_c = invoice.companyPhone) !== null && _c !== void 0 ? _c : undefined,
            bankName: (_d = invoice.bankName) !== null && _d !== void 0 ? _d : undefined,
            bankAccount: (_e = invoice.bankAccount) !== null && _e !== void 0 ? _e : undefined,
        });
        try {
            // 行级明细快照（价税分离）固化到发票
            let lines = null;
            let totals = null;
            if (this.orderService) {
                const built = await this.buildLinesSnapshot(ctx, invoice.orderIds);
                lines = built.lines;
                totals = built.totals;
                invoice.lines = lines;
                invoice.totals = totals;
            }
            const invoiceNo = await this.generateInvoiceNo(ctx, invoice);
            const result = await this.provider.issue(ctx, {
                invoiceType: invoice.invoiceType,
                title: invoice.title,
                taxNumber: (_f = invoice.taxNumber) !== null && _f !== void 0 ? _f : undefined,
                email: (_g = invoice.email) !== null && _g !== void 0 ? _g : undefined,
                companyAddress: (_h = invoice.companyAddress) !== null && _h !== void 0 ? _h : undefined,
                companyPhone: (_j = invoice.companyPhone) !== null && _j !== void 0 ? _j : undefined,
                bankName: (_k = invoice.bankName) !== null && _k !== void 0 ? _k : undefined,
                bankAccount: (_l = invoice.bankAccount) !== null && _l !== void 0 ? _l : undefined,
                amount: invoice.amount,
                orderIds: invoice.orderIds,
                invoiceNo,
                lines: lines !== null && lines !== void 0 ? lines : undefined,
                totals: totals !== null && totals !== void 0 ? totals : undefined,
            });
            if (result.success) {
                invoice.status = invoice_entity_1.InvoiceStatus.ISSUED;
                invoice.providerInvoiceNo = (_m = result.invoiceNo) !== null && _m !== void 0 ? _m : null;
                invoice.invoiceNo = (_o = result.invoiceNo) !== null && _o !== void 0 ? _o : null;
                invoice.pdfUrl = (_p = result.pdfUrl) !== null && _p !== void 0 ? _p : null;
                invoice.issuedAt = new Date();
                invoice.lastError = null;
            }
            else {
                invoice.status = invoice_entity_1.InvoiceStatus.FAILED;
                invoice.lastError = (_q = result.error) !== null && _q !== void 0 ? _q : 'Unknown error';
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
    /** 自动开票：按订单自定义字段开票（autoIssue 开关开启时，订单进入可开票状态由 plugin 触发）。
     *  该方法以系统身份开票，不校验 activeUserId 归属（自动流不限定客户前端）。 */
    async autoIssueForOrder(ctx, orderId) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        if (!this.orderService) {
            throw new Error('OrderService not initialized');
        }
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user']);
        if (!order)
            return null;
        const custom = (_a = order.customFields) !== null && _a !== void 0 ? _a : {};
        if (!custom.invoiceRequired) {
            // 订单未要求开票，跳过
            return null;
        }
        // 幂等：已有 PENDING/ISSUED 发票则跳过
        const repo = this.connection.getRepository(ctx, invoice_entity_1.Invoice);
        const existing = await repo.find({
            where: {
                customerId: (_c = (_b = order.customer) === null || _b === void 0 ? void 0 : _b.user) === null || _c === void 0 ? void 0 : _c.id,
                status: (0, typeorm_1.Not)((0, typeorm_1.In)([invoice_entity_1.InvoiceStatus.REVERSED, invoice_entity_1.InvoiceStatus.FAILED])),
            },
        });
        if (existing.some(inv => (inv.orderIds || []).includes(Number(orderId)))) {
            return null;
        }
        // 复用订单自定义字段作为抬头快照
        const invoice = new invoice_entity_1.Invoice({
            invoiceType: ((_d = custom.invoiceType) !== null && _d !== void 0 ? _d : 'ordinary'),
            status: invoice_entity_1.InvoiceStatus.PENDING,
            title: custom.invoiceTitle || ((_e = order.customer) === null || _e === void 0 ? void 0 : _e.displayName) || ((_f = order.customer) === null || _f === void 0 ? void 0 : _f.firstName) || '客户',
            taxNumber: (_g = custom.invoiceTaxNumber) !== null && _g !== void 0 ? _g : null,
            email: (_h = custom.invoiceEmail) !== null && _h !== void 0 ? _h : null,
            companyAddress: (_j = custom.invoiceCompanyAddress) !== null && _j !== void 0 ? _j : null,
            companyPhone: (_k = custom.invoiceCompanyPhone) !== null && _k !== void 0 ? _k : null,
            bankName: (_l = custom.invoiceBankName) !== null && _l !== void 0 ? _l : null,
            bankAccount: (_m = custom.invoiceBankAccount) !== null && _m !== void 0 ? _m : null,
            amount: (_o = order.total) !== null && _o !== void 0 ? _o : 0,
            customerId: (_q = (_p = order.customer) === null || _p === void 0 ? void 0 : _p.user) === null || _q === void 0 ? void 0 : _q.id,
            channelId: ctx.channelId,
            orderIds: [Number(orderId)],
        });
        invoice.channels = [ctx.channel];
        const saved = await repo.save(invoice);
        core_1.Logger.info(`Auto-issued invoice ${saved.id} for order ${orderId}`, constants_1.loggerCtx);
        // 合规校验失败/其他错误不阻塞：记录失败状态
        try {
            return await this.issueInvoice(ctx, saved.id);
        }
        catch (e) {
            saved.status = invoice_entity_1.InvoiceStatus.FAILED;
            saved.lastError = e.message;
            await repo.save(saved);
            core_1.Logger.error(`autoIssue order ${orderId} failed: ${e.message}`, constants_1.loggerCtx);
            return saved;
        }
    }
    /** 批量开票：逐张签发，单张失败不阻塞其他；返回全部结果（含 lastError） */
    async bulkIssueInvoices(ctx, ids) {
        var _a;
        if (!ids || ids.length === 0) {
            throw new core_1.UserInputError('ids must not be empty');
        }
        const results = [];
        for (const id of ids) {
            try {
                results.push(await this.issueInvoice(ctx, id));
            }
            catch (e) {
                // 单张失败：读回并把 lastError 记为失败，标记 FAILED，继续其余
                const repo = this.connection.getRepository(ctx, invoice_entity_1.Invoice);
                const inv = await repo.findOne({ where: { id: id } });
                if (inv) {
                    inv.status = invoice_entity_1.InvoiceStatus.FAILED;
                    inv.lastError = (_a = e.message) !== null && _a !== void 0 ? _a : String(e);
                    await repo.save(inv);
                    results.push(inv);
                }
                core_1.Logger.error(`bulkIssue: invoice ${id} failed: ${e.message}`, constants_1.loggerCtx);
            }
        }
        return results;
    }
    /** 归一化发票号：INV-{yyyyMMdd}-{channelId}-{seq}（seq=同渠道当日已签发发票数+1） */
    async generateInvoiceNo(ctx, invoice) {
        const d = new Date();
        const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        const repo = this.connection.getRepository(ctx, invoice_entity_1.Invoice);
        const count = await repo.count({
            where: {
                channelId: ctx.channelId,
                issuedAt: (0, typeorm_1.Between)(start, end),
            },
        });
        const seq = count + 1;
        return `INV-${ymd}-${String(ctx.channelId)}-${String(seq).padStart(4, '0')}`;
    }
    /** 把订单行聚合为价税分离快照（供 PDF / 展示复用，与订单解耦） */
    async buildLinesSnapshot(ctx, orderIds) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const lines = [];
        for (const orderId of orderIds) {
            const order = await this.orderService.findOne(ctx, orderId, ['lines', 'lines.productVariant']);
            if (!order)
                continue;
            for (const line of ((_a = order.lines) !== null && _a !== void 0 ? _a : [])) {
                const qty = (_b = line.quantity) !== null && _b !== void 0 ? _b : 0;
                const priceWithTax = (_c = line.proratedLinePriceWithTax) !== null && _c !== void 0 ? _c : 0;
                // 净额 = 价税合计 - 税额
                let priceNet = (_d = line.proratedLinePrice) !== null && _d !== void 0 ? _d : priceWithTax;
                const taxRate = this.taxRateOf(line);
                const taxAmount = Math.round(priceNet * taxRate / 100);
                lines.push({
                    orderId: Number(order.id),
                    orderCode: order.code,
                    productVariantId: ((_e = line.productVariant) === null || _e === void 0 ? void 0 : _e.id) ? Number(line.productVariant.id) : undefined,
                    sku: (_g = (_f = line.productVariant) === null || _f === void 0 ? void 0 : _f.sku) !== null && _g !== void 0 ? _g : undefined,
                    name: ((_h = line.productVariant) === null || _h === void 0 ? void 0 : _h.name) || 'Item',
                    quantity: qty,
                    unitPrice: qty ? Math.round(priceNet / qty) : 0,
                    unitPriceWithTax: qty ? Math.round(priceWithTax / qty) : 0,
                    amount: priceNet,
                    taxRate,
                    taxAmount,
                    amountWithTax: priceWithTax,
                });
            }
        }
        const totals = {
            totalExcludingTax: lines.reduce((s, l) => { var _a; return s + ((_a = l.amount) !== null && _a !== void 0 ? _a : 0); }, 0),
            totalTax: lines.reduce((s, l) => { var _a; return s + ((_a = l.taxAmount) !== null && _a !== void 0 ? _a : 0); }, 0),
            totalWithTax: lines.reduce((s, l) => { var _a; return s + ((_a = l.amountWithTax) !== null && _a !== void 0 ? _a : 0); }, 0),
        };
        return { lines, totals };
    }
    /** 从订单行解析税率（%） */
    taxRateOf(line) {
        var _a;
        const t = (_a = line.taxLines) === null || _a === void 0 ? void 0 : _a[0];
        if (t && typeof t.taxRate === 'number')
            return t.taxRate;
        return 0;
    }
    /** 发票合规校验（轻量）：专票必填三要素+税号；税号格式（提示，不阻止 mock 开票） */
    assertCompliant(input) {
        if (String(input.invoiceType) === invoice_entity_1.InvoiceType.SPECIAL) {
            const missing = [];
            if (!input.taxNumber)
                missing.push('税号');
            if (!input.bankName)
                missing.push('开户行');
            if (!input.bankAccount)
                missing.push('银行账号');
            if (!input.companyAddress)
                missing.push('注册地址');
            if (!input.companyPhone)
                missing.push('注册电话');
            if (missing.length) {
                throw new core_1.UserInputError(`专用发票必填：${missing.join('、')}`);
            }
        }
        if (input.taxNumber && !TAX_ID_PATTERN.test(String(input.taxNumber).trim())) {
            throw new core_1.UserInputError('税号格式不正确（应为15/17/18/20位字母数字）');
        }
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