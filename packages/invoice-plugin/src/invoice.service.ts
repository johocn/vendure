import { Injectable } from '@nestjs/common';
import { In, Not, Between } from 'typeorm';
import {
    ID,
    Injector,
    ListQueryBuilder,
    ListQueryOptions,
    Logger,
    OrderService,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
    EntityNotFoundError,
    ForbiddenError,
    UnauthorizedError,
    UserInputError,
} from '@vendure/core';

import { loggerCtx, INVOICE_PLUGIN_OPTIONS } from './constants';
import { Invoice, InvoiceLine, InvoiceStatus, InvoiceTotals, InvoiceType } from './invoice.entity';
import { InvoiceProvider, NoopInvoiceProvider } from './invoice-provider';
import { InvoicePluginOptions } from './types';
import { InvoiceTitleService } from './invoice-title.service';

export interface CreateInvoiceInput {
    orderIds: ID[];
    invoiceType: InvoiceType | string;
    title: string;
    taxNumber?: string;
    email?: string;
    companyAddress?: string;
    companyPhone?: string;
    bankName?: string;
    bankAccount?: string;
    amount?: number;
    /** 复用已存抬头：命中后回填抬头/税号/邮箱/地址/开户行/账号到发票快照 */
    invoiceTitleId?: ID;
}

const TAX_ID_PATTERN = /^[0-9A-Z]{15}$|^[0-9A-Z]{17}$|^[0-9A-Z]{18}$|^[0-9A-Z]{20}$/i;

@Injectable()
export class InvoiceService {
    private orderService: OrderService | null = null;
    private titleService: InvoiceTitleService | null = null;
    private options: InvoicePluginOptions = {};
    private provider: InvoiceProvider = new NoopInvoiceProvider();

    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
    ) {}

    init(injector: Injector): void {
        this.orderService = injector.get(OrderService);
        try {
            this.titleService = injector.get(InvoiceTitleService);
        } catch (e: any) {
            this.titleService = null;
        }
        try {
            this.options = injector.get<InvoicePluginOptions>(INVOICE_PLUGIN_OPTIONS as any) ?? {};
        } catch {
            this.options = {};
        }
        this.provider = this.options.provider ?? new NoopInvoiceProvider();
        Logger.info(`InvoiceService initialized with provider: ${this.provider.config.code}`, loggerCtx);
    }

    async getInvoice(ctx: RequestContext, id: ID): Promise<Invoice | undefined> {
        const repo = this.connection.getRepository(ctx, Invoice);
        const result = await repo.findOne({
            where: { id: id as any },
            relations: { channels: true },
        });
        return result ?? undefined;
    }

    async getInvoices(
        ctx: RequestContext,
        options?: ListQueryOptions<Invoice>,
    ): Promise<PaginatedList<Invoice>> {
        return this.listQueryBuilder
            .build(Invoice, options, {
                ctx,
                relations: ['channels'],
                channelId: ctx.channelId,
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async getMyInvoices(ctx: RequestContext): Promise<Invoice[]> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const repo = this.connection.getRepository(ctx, Invoice);
        return repo.find({
            where: { customerId: ctx.activeUserId as any },
            relations: { channels: true },
        });
    }

    async getMyInvoice(ctx: RequestContext, id: ID): Promise<Invoice | undefined> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const repo = this.connection.getRepository(ctx, Invoice);
        const result = await repo.findOne({
            where: { id: id as any, customerId: ctx.activeUserId as any },
            relations: { channels: true },
        });
        return result ?? undefined;
    }

    async createInvoice(ctx: RequestContext, input: CreateInvoiceInput): Promise<Invoice> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        if (!this.orderService) {
            throw new Error('OrderService not initialized');
        }
        if (!input.orderIds || input.orderIds.length === 0) {
            throw new UserInputError('orderIds must not be empty');
        }
        if (!input.title) {
            throw new UserInputError('title must not be empty');
        }

        // 0. 合规校验
        this.assertCompliant(input as any);

        // 0b. 抬头复用：invoiceTitleId 命中后回填抬头快照字段
        const snapshot = { ...input };
        if (input.invoiceTitleId) {
            if (!this.titleService) {
                throw new Error('InvoiceTitleService not initialized');
            }
            const title = await this.titleService.getOwned(ctx, input.invoiceTitleId);
            snapshot.title = title.title;
            snapshot.taxNumber = title.taxNumber ?? undefined;
            snapshot.email = title.email ?? undefined;
            snapshot.companyAddress = title.companyAddress ?? undefined;
            snapshot.companyPhone = title.companyPhone ?? undefined;
            snapshot.bankName = title.bankName ?? undefined;
            snapshot.bankAccount = title.bankAccount ?? undefined;
        }

        // 1. 校验订单归属 + 状态，累计订单实付金额
        let totalPaid = 0;
        for (const orderId of input.orderIds) {
            const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user']);
            if (!order) {
                throw new UserInputError(`Order ${orderId} not found`);
            }
            // order.customer.id 是 Customer 主键，ctx.activeUserId 是关联 User 主键，二者不同；
            // 归属校验基于 customer.user.id 与 activeUserId 比较。
            const customerUserId = (order.customer as any)?.user?.id;
            if (!order.customer || customerUserId == null || String(customerUserId) !== String(ctx.activeUserId)) {
                throw new ForbiddenError();
            }
            const allowedStates = ['Delivered', 'Completed', 'PartialDelivery'];
            if (!allowedStates.includes(order.state)) {
                throw new UserInputError(
                    `Order ${orderId} state must be one of ${allowedStates.join('/')}, got ${order.state}`,
                );
            }
            totalPaid += (order.total ?? 0);
        }

        // 2. 重复开票校验（任一 orderId 已有 PENDING/ISSUED 发票）
        const repo = this.connection.getRepository(ctx, Invoice);
        const existing = await repo.find({
            where: {
                customerId: ctx.activeUserId as any,
                status: Not(In([InvoiceStatus.REVERSED, InvoiceStatus.FAILED])),
            },
        });
        const orderIdSet = new Set(input.orderIds.map(id => String(id)));
        for (const inv of existing) {
            const overlap = (inv.orderIds || []).some(oid => orderIdSet.has(String(oid)));
            if (overlap) {
                throw new UserInputError(`Invoice already exists for one of orderIds (invoice #${inv.id})`);
            }
        }

        // 3. 金额上限校验（开票金额 ≤ 订单实付金额合计）
        const amount = snapshot.amount ?? totalPaid;
        if (amount > totalPaid) {
            throw new UserInputError(`Invoice amount ${amount} exceeds orders total ${totalPaid}`);
        }

        // 4. 创建 Invoice 记录（用快照的抬头字段）
        const invoice = new Invoice({
            invoiceType: snapshot.invoiceType as InvoiceType,
            status: InvoiceStatus.PENDING,
            title: snapshot.title,
            taxNumber: snapshot.taxNumber ?? null,
            email: snapshot.email ?? null,
            companyAddress: snapshot.companyAddress ?? null,
            companyPhone: snapshot.companyPhone ?? null,
            bankName: snapshot.bankName ?? null,
            bankAccount: snapshot.bankAccount ?? null,
            amount,
            customerId: ctx.activeUserId as any,
            channelId: ctx.channelId as any,
            orderIds: input.orderIds.map(id => Number(id)),
        });
        invoice.channels = [ctx.channel];
        const saved = await repo.save(invoice);
        Logger.info(`Invoice ${saved.id} created by customer ${ctx.activeUserId}`, loggerCtx);
        return saved;
    }

    async issueInvoice(ctx: RequestContext, id: ID): Promise<Invoice> {
        const repo = this.connection.getRepository(ctx, Invoice);
        const invoice = await repo.findOne({ where: { id: id as any } });
        if (!invoice) {
            throw new EntityNotFoundError('Invoice', id);
        }
        if (invoice.status !== InvoiceStatus.PENDING) {
            throw new UserInputError(`Invoice status must be PENDING, got ${invoice.status}`);
        }
        // 合规校验：issue 前再次校验（税号格式等）
        this.assertCompliant({
            invoiceType: invoice.invoiceType,
            title: invoice.title,
            taxNumber: invoice.taxNumber ?? undefined,
            companyAddress: invoice.companyAddress ?? undefined,
            companyPhone: invoice.companyPhone ?? undefined,
            bankName: invoice.bankName ?? undefined,
            bankAccount: invoice.bankAccount ?? undefined,
        } as any);
        try {
            // 行级明细快照（价税分离）固化到发票
            let lines: InvoiceLine[] | null = null;
            let totals: InvoiceTotals | null = null;
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
                taxNumber: invoice.taxNumber ?? undefined,
                email: invoice.email ?? undefined,
                companyAddress: invoice.companyAddress ?? undefined,
                companyPhone: invoice.companyPhone ?? undefined,
                bankName: invoice.bankName ?? undefined,
                bankAccount: invoice.bankAccount ?? undefined,
                amount: invoice.amount,
                orderIds: invoice.orderIds,
                invoiceNo,
                lines: lines ?? undefined,
                totals: totals ?? undefined,
            });
            if (result.success) {
                invoice.status = InvoiceStatus.ISSUED;
                invoice.providerInvoiceNo = result.invoiceNo ?? null;
                invoice.invoiceNo = result.invoiceNo ?? null;
                invoice.pdfUrl = result.pdfUrl ?? null;
                invoice.issuedAt = new Date();
                invoice.lastError = null;
            } else {
                invoice.status = InvoiceStatus.FAILED;
                invoice.lastError = result.error ?? 'Unknown error';
            }
            await repo.save(invoice);
        } catch (e: any) {
            invoice.status = InvoiceStatus.FAILED;
            invoice.lastError = e.message;
            await repo.save(invoice);
            Logger.error(`Issue invoice ${id} failed: ${e.message}`, loggerCtx);
            throw e;
        }
        return invoice;
    }

    /** 自动开票：按订单自定义字段开票（autoIssue 开关开启时，订单进入可开票状态由 plugin 触发）。
     *  该方法以系统身份开票，不校验 activeUserId 归属（自动流不限定客户前端）。 */
    async autoIssueForOrder(ctx: RequestContext, orderId: ID): Promise<Invoice | null> {
        if (!this.orderService) {
            throw new Error('OrderService not initialized');
        }
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user']);
        if (!order) return null;
        const custom = (order as any).customFields ?? {};
        if (!custom.invoiceRequired) {
            // 订单未要求开票，跳过
            return null;
        }
        // 幂等：已有 PENDING/ISSUED 发票则跳过
        const repo = this.connection.getRepository(ctx, Invoice);
        const existing = await repo.find({
            where: {
                customerId: (order.customer as any)?.user?.id as any,
                status: Not(In([InvoiceStatus.REVERSED, InvoiceStatus.FAILED])),
            },
        });
        if (existing.some(inv => (inv.orderIds || []).includes(Number(orderId)))) {
            return null;
        }
        // 复用订单自定义字段作为抬头快照
        const invoice = new Invoice({
            invoiceType: (custom.invoiceType ?? 'ordinary') as InvoiceType,
            status: InvoiceStatus.PENDING,
            title: custom.invoiceTitle || (order.customer as any)?.displayName || (order.customer as any)?.firstName || '客户',
            taxNumber: custom.invoiceTaxNumber ?? null,
            email: custom.invoiceEmail ?? null,
            companyAddress: custom.invoiceCompanyAddress ?? null,
            companyPhone: custom.invoiceCompanyPhone ?? null,
            bankName: custom.invoiceBankName ?? null,
            bankAccount: custom.invoiceBankAccount ?? null,
            amount: order.total ?? 0,
            customerId: (order.customer as any)?.user?.id as any,
            channelId: ctx.channelId as any,
            orderIds: [Number(orderId)],
        });
        invoice.channels = [ctx.channel];
        const saved = await repo.save(invoice);
        Logger.info(`Auto-issued invoice ${saved.id} for order ${orderId}`, loggerCtx);
        // 合规校验失败/其他错误不阻塞：记录失败状态
        try {
            return await this.issueInvoice(ctx, saved.id);
        } catch (e: any) {
            saved.status = InvoiceStatus.FAILED;
            saved.lastError = e.message;
            await repo.save(saved);
            Logger.error(`autoIssue order ${orderId} failed: ${e.message}`, loggerCtx);
            return saved;
        }
    }

    /** 批量开票：逐张签发，单张失败不阻塞其他；返回全部结果（含 lastError） */
    async bulkIssueInvoices(ctx: RequestContext, ids: ID[]): Promise<Invoice[]> {
        if (!ids || ids.length === 0) {
            throw new UserInputError('ids must not be empty');
        }
        const results: Invoice[] = [];
        for (const id of ids) {
            try {
                results.push(await this.issueInvoice(ctx, id));
            } catch (e: any) {
                // 单张失败：读回并把 lastError 记为失败，标记 FAILED，继续其余
                const repo = this.connection.getRepository(ctx, Invoice);
                const inv = await repo.findOne({ where: { id: id as any } });
                if (inv) {
                    inv.status = InvoiceStatus.FAILED;
                    inv.lastError = e.message ?? String(e);
                    await repo.save(inv);
                    results.push(inv);
                }
                Logger.error(`bulkIssue: invoice ${id} failed: ${e.message}`, loggerCtx);
            }
        }
        return results;
    }

    /** 归一化发票号：INV-{yyyyMMdd}-{channelId}-{seq}（seq=同渠道当日已签发发票数+1） */
    private async generateInvoiceNo(ctx: RequestContext, invoice: Invoice): Promise<string> {
        const d = new Date();
        const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        const repo = this.connection.getRepository(ctx, Invoice);
        const count = await repo.count({
            where: {
                channelId: ctx.channelId as any,
                issuedAt: Between(start, end),
            } as any,
        });
        const seq = count + 1;
        return `INV-${ymd}-${String(ctx.channelId)}-${String(seq).padStart(4, '0')}`;
    }

    /** 把订单行聚合为价税分离快照（供 PDF / 展示复用，与订单解耦） */
    private async buildLinesSnapshot(ctx: RequestContext, orderIds: number[]): Promise<{ lines: InvoiceLine[]; totals: InvoiceTotals }> {
        const lines: InvoiceLine[] = [];
        for (const orderId of orderIds) {
            const order = await this.orderService!.findOne(ctx, orderId, ['lines', 'lines.productVariant']);
            if (!order) continue;
            for (const line of (order.lines ?? []) as any[]) {
                const qty = line.quantity ?? 0;
                const priceWithTax = line.proratedLinePriceWithTax ?? 0;
                // 净额 = 价税合计 - 税额
                let priceNet = line.proratedLinePrice ?? priceWithTax;
                const taxRate = this.taxRateOf(line);
                const taxAmount = Math.round(priceNet * taxRate / 100);
                lines.push({
                    orderId: Number(order.id),
                    orderCode: order.code,
                    productVariantId: line.productVariant?.id ? Number(line.productVariant.id) : undefined,
                    sku: line.productVariant?.sku ?? undefined,
                    name: line.productVariant?.name || 'Item',
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
        const totals: InvoiceTotals = {
            totalExcludingTax: lines.reduce((s, l) => s + (l.amount ?? 0), 0),
            totalTax: lines.reduce((s, l) => s + (l.taxAmount ?? 0), 0),
            totalWithTax: lines.reduce((s, l) => s + (l.amountWithTax ?? 0), 0),
        };
        return { lines, totals };
    }

    /** 从订单行解析税率（%） */
    private taxRateOf(line: any): number {
        const t = line.taxLines?.[0];
        if (t && typeof t.taxRate === 'number') return t.taxRate;
        return 0;
    }

    /** 发票合规校验（轻量）：专票必填三要素+税号；税号格式（提示，不阻止 mock 开票） */
    private assertCompliant(input: {
        invoiceType: string;
        title?: string;
        taxNumber?: string;
        companyAddress?: string;
        companyPhone?: string;
        bankName?: string;
        bankAccount?: string;
    }): void {
        if (String(input.invoiceType) === InvoiceType.SPECIAL) {
            const missing: string[] = [];
            if (!input.taxNumber) missing.push('税号');
            if (!input.bankName) missing.push('开户行');
            if (!input.bankAccount) missing.push('银行账号');
            if (!input.companyAddress) missing.push('注册地址');
            if (!input.companyPhone) missing.push('注册电话');
            if (missing.length) {
                throw new UserInputError(`专用发票必填：${missing.join('、')}`);
            }
        }
        if (input.taxNumber && !TAX_ID_PATTERN.test(String(input.taxNumber).trim())) {
            throw new UserInputError('税号格式不正确（应为15/17/18/20位字母数字）');
        }
    }

    async reverseInvoice(ctx: RequestContext, id: ID, reason: string): Promise<Invoice> {
        const repo = this.connection.getRepository(ctx, Invoice);
        const invoice = await repo.findOne({ where: { id: id as any } });
        if (!invoice) {
            throw new EntityNotFoundError('Invoice', id);
        }
        if (invoice.status !== InvoiceStatus.ISSUED) {
            throw new UserInputError(`Invoice status must be ISSUED, got ${invoice.status}`);
        }
        if (!invoice.providerInvoiceNo) {
            throw new UserInputError('Invoice has no providerInvoiceNo to reverse');
        }
        try {
            const result = await this.provider.reverse(ctx, invoice.providerInvoiceNo, reason);
            if (result.success) {
                invoice.status = InvoiceStatus.REVERSED;
                invoice.reverseReason = reason;
                invoice.reversedAt = new Date();
                invoice.lastError = null;
            } else {
                invoice.lastError = result.error ?? 'Unknown error';
            }
            await repo.save(invoice);
        } catch (e: any) {
            invoice.lastError = e.message;
            await repo.save(invoice);
            Logger.error(`Reverse invoice ${id} failed: ${e.message}`, loggerCtx);
            throw e;
        }
        return invoice;
    }

    async downloadPdf(ctx: RequestContext, id: ID): Promise<Invoice> {
        const repo = this.connection.getRepository(ctx, Invoice);
        const invoice = await repo.findOne({ where: { id: id as any } });
        if (!invoice) {
            throw new EntityNotFoundError('Invoice', id);
        }
        if (invoice.status !== InvoiceStatus.ISSUED) {
            throw new UserInputError(`Invoice status must be ISSUED, got ${invoice.status}`);
        }
        if (!invoice.pdfUrl && invoice.providerInvoiceNo) {
            const result = await this.provider.queryPdf(ctx, invoice.providerInvoiceNo);
            if (result.pdfUrl) {
                invoice.pdfUrl = result.pdfUrl;
                await repo.save(invoice);
            } else if (result.error) {
                invoice.lastError = result.error;
                await repo.save(invoice);
            }
        }
        return invoice;
    }
}
