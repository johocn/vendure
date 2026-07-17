import { Injectable } from '@nestjs/common';
import { In, Not } from 'typeorm';
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
import { Invoice, InvoiceStatus, InvoiceType } from './invoice.entity';
import { InvoiceProvider, NoopInvoiceProvider } from './invoice-provider';
import { InvoicePluginOptions } from './types';

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
}

@Injectable()
export class InvoiceService {
    private orderService: OrderService | null = null;
    private options: InvoicePluginOptions = {};
    private provider: InvoiceProvider = new NoopInvoiceProvider();

    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
    ) {}

    init(injector: Injector): void {
        this.orderService = injector.get(OrderService);
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

        // 1. 校验订单归属 + 状态，累计订单实付金额
        let totalPaid = 0;
        for (const orderId of input.orderIds) {
            const order = await this.orderService.findOne(ctx, orderId, ['customer']);
            if (!order) {
                throw new UserInputError(`Order ${orderId} not found`);
            }
            if (!order.customer || String(order.customer.id) !== String(ctx.activeUserId)) {
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
        const amount = input.amount ?? totalPaid;
        if (amount > totalPaid) {
            throw new UserInputError(`Invoice amount ${amount} exceeds orders total ${totalPaid}`);
        }

        // 4. 创建 Invoice 记录
        const invoice = new Invoice({
            invoiceType: input.invoiceType as InvoiceType,
            status: InvoiceStatus.PENDING,
            title: input.title,
            taxNumber: input.taxNumber ?? null,
            email: input.email ?? null,
            companyAddress: input.companyAddress ?? null,
            companyPhone: input.companyPhone ?? null,
            bankName: input.bankName ?? null,
            bankAccount: input.bankAccount ?? null,
            amount,
            customerId: ctx.activeUserId as any,
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
        try {
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
            });
            if (result.success) {
                invoice.status = InvoiceStatus.ISSUED;
                invoice.providerInvoiceNo = result.invoiceNo ?? null;
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
