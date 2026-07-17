import { InvoiceProvider } from './invoice-provider';

export interface InvoicePluginOptions {
    provider?: InvoiceProvider;
    enabledTypes?: ('ordinary' | 'special' | 'electronic')[];
}
