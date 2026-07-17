import { RequestContext } from '@vendure/core';

import { InvoiceType } from './invoice.entity';

export interface InvoiceProviderConfig {
    code: string;
    name: string;
}

export interface IssueInvoiceInput {
    invoiceType: InvoiceType;
    title: string;
    taxNumber?: string;
    email?: string;
    companyAddress?: string;
    companyPhone?: string;
    bankName?: string;
    bankAccount?: string;
    amount: number;
    orderIds: number[];
}

export interface IssueInvoiceResult {
    success: boolean;
    invoiceNo?: string;
    pdfUrl?: string;
    error?: string;
}

export interface ReverseInvoiceResult {
    success: boolean;
    error?: string;
}

export interface QueryPdfResult {
    pdfUrl?: string;
    error?: string;
}

export interface InvoiceProvider {
    config: InvoiceProviderConfig;
    issue(ctx: RequestContext, input: IssueInvoiceInput): Promise<IssueInvoiceResult>;
    reverse(ctx: RequestContext, invoiceNo: string, reason: string): Promise<ReverseInvoiceResult>;
    queryPdf(ctx: RequestContext, invoiceNo: string): Promise<QueryPdfResult>;
}

export class NoopInvoiceProvider implements InvoiceProvider {
    config = { code: 'noop', name: 'Noop (未配置)' };

    async issue(): Promise<IssueInvoiceResult> {
        return { success: true, invoiceNo: 'NOOP-' + Date.now(), pdfUrl: undefined };
    }

    async reverse(): Promise<ReverseInvoiceResult> {
        return { success: true };
    }

    async queryPdf(): Promise<QueryPdfResult> {
        return { pdfUrl: undefined };
    }
}
