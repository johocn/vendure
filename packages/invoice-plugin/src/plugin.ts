import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventBus, Injector, Logger, OrderStateTransitionEvent, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { INVOICE_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { InvoicePluginOptions } from './types';
import { invoiceOrderCustomFields } from './order-custom-fields';
import { Invoice } from './invoice.entity';
import { InvoiceService } from './invoice.service';
import { InvoiceAdminResolver } from './invoice-admin.resolver';
import { InvoiceShopResolver } from './invoice-shop.resolver';
import { InvoiceTitle } from './invoice-title.entity';
import { InvoiceTitleService } from './invoice-title.service';
import { InvoiceTitleShopResolver } from './invoice-title-shop.resolver';

/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields<T extends { name: string }>(
    existingFields: T[] | undefined,
    additions: T[] | undefined,
): T[] {
    const names = new Set((existingFields ?? []).map(f => f.name));
    return [...(existingFields ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}

const { gql } = require('graphql-tag');

const adminSchema = () => gql`
    type InvoiceLine {
        orderId: ID!
        orderCode: String!
        productVariantId: ID
        sku: String
        name: String!
        quantity: Int!
        unitPrice: Int!
        unitPriceWithTax: Int!
        amount: Int!
        taxRate: Int!
        taxAmount: Int!
        amountWithTax: Int!
    }

    type InvoiceTotals {
        totalExcludingTax: Int!
        totalTax: Int!
        totalWithTax: Int!
    }

    type Invoice implements Node {
        id: ID!
        invoiceType: String!
        status: String!
        title: String!
        taxNumber: String
        email: String
        companyAddress: String
        companyPhone: String
        bankName: String
        bankAccount: String
        amount: Int!
        customerId: ID!
        orderIds: [ID!]!
        lines: [InvoiceLine!]
        totals: InvoiceTotals
        invoiceNo: String
        pdfUrl: String
        issuedAt: DateTime
        reversedAt: DateTime
        reverseReason: String
        voidedAt: DateTime
        voidReason: String
        parentInvoiceId: ID
        isRed: Boolean!
        partiallyReversed: Boolean!
        reversedAmount: Int
        providerInvoiceNo: String
        lastError: String
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type InvoiceList implements PaginatedList {
        items: [Invoice!]!
        totalItems: Int!
    }

    input InvoiceSortParameter {
        id: SortOrder
        title: SortOrder
        invoiceType: SortOrder
        status: SortOrder
        amount: SortOrder
        customerId: SortOrder
        createdAt: SortOrder
        issuedAt: SortOrder
        updatedAt: SortOrder
    }

    input InvoiceFilterParameter {
        id: IDOperators
        title: StringOperators
        invoiceNo: StringOperators
        taxNumber: StringOperators
        status: StringOperators
        invoiceType: StringOperators
        amount: NumberOperators
        customerId: IDOperators
        createdAt: DateOperators
        updatedAt: DateOperators
        issuedAt: DateOperators
    }

    input InvoiceListOptions {
        skip: Int
        take: Int
        sort: InvoiceSortParameter
        filter: InvoiceFilterParameter
    }

    extend type Query {
        invoices(options: InvoiceListOptions): InvoiceList!
        invoice(id: ID!): Invoice
        exportInvoicesCsv(options: InvoiceListOptions): String!
    }

    extend type Mutation {
        issueInvoice(id: ID!): Invoice!
        reverseInvoice(id: ID!, reason: String!, reverseAmount: Int): Invoice!
        voidInvoice(id: ID!, reason: String!): Invoice!
        bulkIssueInvoices(ids: [ID!]!): [Invoice!]!
    }
`;

const shopSchema = () => gql`
    type InvoiceLine {
        orderId: ID!
        orderCode: String!
        productVariantId: ID
        sku: String
        name: String!
        quantity: Int!
        unitPrice: Int!
        unitPriceWithTax: Int!
        amount: Int!
        taxRate: Int!
        taxAmount: Int!
        amountWithTax: Int!
    }

    type InvoiceTotals {
        totalExcludingTax: Int!
        totalTax: Int!
        totalWithTax: Int!
    }

    type Invoice implements Node {
        id: ID!
        invoiceType: String!
        status: String!
        title: String!
        taxNumber: String
        email: String
        companyAddress: String
        companyPhone: String
        bankName: String
        bankAccount: String
        amount: Int!
        customerId: ID!
        orderIds: [ID!]!
        lines: [InvoiceLine!]
        totals: InvoiceTotals
        invoiceNo: String
        pdfUrl: String
        issuedAt: DateTime
        reversedAt: DateTime
        reverseReason: String
        voidedAt: DateTime
        voidReason: String
        parentInvoiceId: ID
        isRed: Boolean!
        partiallyReversed: Boolean!
        reversedAmount: Int
        providerInvoiceNo: String
        lastError: String
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    input CreateInvoiceInput {
        orderIds: [ID!]!
        invoiceType: String!
        title: String!
        taxNumber: String
        email: String
        companyAddress: String
        companyPhone: String
        bankName: String
        bankAccount: String
        invoiceTitleId: ID
    }

    extend type Query {
        myInvoices: [Invoice!]!
        myInvoice(id: ID!): Invoice
    }

    extend type Mutation {
        createInvoice(input: CreateInvoiceInput!): Invoice!
        downloadInvoicePdf(id: ID!): Invoice!
    }

    type InvoiceTitle implements Node {
        id: ID!
        title: String!
        taxNumber: String
        email: String
        companyAddress: String
        companyPhone: String
        bankName: String
        bankAccount: String
        customerId: ID!
        isDefault: Boolean!
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    input CreateInvoiceTitleInput {
        title: String!
        taxNumber: String
        email: String
        companyAddress: String
        companyPhone: String
        bankName: String
        bankAccount: String
        isDefault: Boolean
    }

    input UpdateInvoiceTitleInput {
        title: String
        taxNumber: String
        email: String
        companyAddress: String
        companyPhone: String
        bankName: String
        bankAccount: String
        isDefault: Boolean
    }

    extend type Query {
        myInvoiceTitles: [InvoiceTitle!]!
    }

    extend type Mutation {
        createInvoiceTitle(input: CreateInvoiceTitleInput!): InvoiceTitle!
        updateInvoiceTitle(id: ID!, input: UpdateInvoiceTitleInput!): InvoiceTitle!
        setDefaultInvoiceTitle(id: ID!): InvoiceTitle!
        deleteInvoiceTitle(id: ID!): Boolean!
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [Invoice, InvoiceTitle],
    providers: [
        { provide: INVOICE_PLUGIN_OPTIONS, useFactory: () => InvoicePlugin.options },
        InvoiceService,
        InvoiceTitleService,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [InvoiceAdminResolver],
    },
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [InvoiceShopResolver, InvoiceTitleShopResolver],
    },
    configuration: (config) => {
        config.customFields.Order = mergeCustomFields(config.customFields.Order, invoiceOrderCustomFields.Order);
        return config;
    },
    dashboard: '../dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class InvoicePlugin implements OnApplicationBootstrap {
    private static options: InvoicePluginOptions = {};
    private injector: Injector;

    constructor(
        @Inject(INVOICE_PLUGIN_OPTIONS) private options: InvoicePluginOptions,
        private invoiceService: InvoiceService,
        private moduleRef: ModuleRef,
    ) {}

    static init(options?: InvoicePluginOptions): Type<InvoicePlugin> {
        InvoicePlugin.options = options ?? {};
        return InvoicePlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        this.injector = new Injector(this.moduleRef);
        this.invoiceService.init(this.injector);
        // 支持可注入的 provider（如 PdfInvoiceProvider：内部懒取 InvoicePdfService/AssetStorageStrategy/OrderService）
        const provider = this.options.provider as any;
        if (provider && typeof provider.init === 'function') {
            provider.init(this.injector);
        }
        // 自动开票（默认关）：订单进入可开票状态且要求发票时自动开具
        if (this.options.autoIssue) {
            const eventBus = this.injector.get(EventBus);
            const allowedStates = ['Delivered', 'Completed', 'PartialDelivery'];
            eventBus.ofType(OrderStateTransitionEvent).subscribe(async (event) => {
                if (!allowedStates.includes(event.toState)) return;
                try {
                    await this.invoiceService.autoIssueForOrder(event.ctx, event.order.id);
                } catch (e: any) {
                    Logger.error(`autoIssue order ${event.order.id} failed: ${e.message}`, loggerCtx);
                }
            });
            Logger.info('autoIssue enabled', loggerCtx);
        }
        Logger.info('InvoicePlugin initialized', loggerCtx);
    }
}
