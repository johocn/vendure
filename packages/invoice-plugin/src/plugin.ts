import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { INVOICE_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { InvoicePluginOptions } from './types';
import { invoiceOrderCustomFields } from './order-custom-fields';
import { Invoice } from './invoice.entity';
import { InvoiceService } from './invoice.service';
import { InvoiceAdminResolver } from './invoice-admin.resolver';
import { InvoiceShopResolver } from './invoice-shop.resolver';

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
        pdfUrl: String
        issuedAt: DateTime
        reversedAt: DateTime
        reverseReason: String
        providerInvoiceNo: String
        lastError: String
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type InvoiceList implements PaginatedList {
        items: [Invoice!]!
        totalItems: Int!
    }

    input InvoiceListOptions

    extend type Query {
        invoices(options: InvoiceListOptions): InvoiceList!
        invoice(id: ID!): Invoice
    }

    extend type Mutation {
        issueInvoice(id: ID!): Invoice!
        reverseInvoice(id: ID!, reason: String!): Invoice!
    }
`;

const shopSchema = () => gql`
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
        pdfUrl: String
        issuedAt: DateTime
        reversedAt: DateTime
        reverseReason: String
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
    }

    extend type Query {
        myInvoices: [Invoice!]!
        myInvoice(id: ID!): Invoice
    }

    extend type Mutation {
        createInvoice(input: CreateInvoiceInput!): Invoice!
        downloadInvoicePdf(id: ID!): Invoice!
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [Invoice],
    providers: [
        { provide: INVOICE_PLUGIN_OPTIONS, useFactory: () => InvoicePlugin.options },
        InvoiceService,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [InvoiceAdminResolver],
    },
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [InvoiceShopResolver],
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
        Logger.info('InvoicePlugin initialized', loggerCtx);
    }
}
