import { Inject, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { INVOICE_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { InvoicePluginOptions } from './types';
import { invoiceOrderCustomFields } from './order-custom-fields';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: INVOICE_PLUGIN_OPTIONS, useFactory: () => InvoicePlugin.options },
    ],
    configuration: (config) => {
        const existingOrderFields = config.customFields.Order ?? [];
        const newOrderFields = invoiceOrderCustomFields.Order ?? [];
        config.customFields.Order = [...existingOrderFields, ...newOrderFields];
        return config;
    },
    dashboard: '../dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class InvoicePlugin {
    private static options: InvoicePluginOptions = {};

    constructor(@Inject(INVOICE_PLUGIN_OPTIONS) private options: InvoicePluginOptions) {}

    static init(options?: InvoicePluginOptions): Type<InvoicePlugin> {
        InvoicePlugin.options = options ?? {};
        return InvoicePlugin;
    }
}
