import { Inject, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import gql from 'graphql-tag';

import { loggerCtx, INVOICE_PDF_PLUGIN_OPTIONS } from './constants';
import { InvoicePdfAdminResolver } from './invoice-pdf-admin.resolver';
import { InvoicePdfService } from './invoice-pdf.service';
import { invoicePdfOrderCustomFields } from './order-custom-fields';
import { InvoicePdfPluginOptions } from './types';

/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields<T extends { name: string }>(
    existingFields: T[] | undefined,
    additions: T[] | undefined,
): T[] {
    const names = new Set((existingFields ?? []).map(f => f.name));
    return [...(existingFields ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: INVOICE_PDF_PLUGIN_OPTIONS, useFactory: () => InvoicePdfPlugin.options },
        InvoicePdfService,
    ],
    adminApiExtensions: {
        schema: () => gql`
            type InvoicePdfResult {
                url: String!
                invoiceNumber: String!
            }

            extend type Mutation {
                generateInvoicePdf(orderId: ID!): InvoicePdfResult!
            }
        `,
        resolvers: [InvoicePdfAdminResolver],
    },
    configuration: (config) => {
        config.customFields.Order = mergeCustomFields(config.customFields.Order, invoicePdfOrderCustomFields.Order);
        return config;
    },
    dashboard: '../dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class InvoicePdfPlugin {
    private static options: InvoicePdfPluginOptions = {};

    constructor(@Inject(INVOICE_PDF_PLUGIN_OPTIONS) private options: InvoicePdfPluginOptions) {}

    static init(options?: InvoicePdfPluginOptions): Type<InvoicePdfPlugin> {
        InvoicePdfPlugin.options = options ?? {};
        return InvoicePdfPlugin;
    }
}
