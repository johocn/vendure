import { RequestContext } from '@vendure/core';
import { InvoiceLine, InvoiceTotals, InvoiceType } from './invoice.entity';
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
    /** 统一发票号（由 provider 或业务层生成，issue 时回填） */
    invoiceNo?: string;
    /** 行级明细快照（价税分离）——由业务层固化后透传给 provider 生成 PDF */
    lines?: InvoiceLine[];
    totals?: InvoiceTotals;
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
export declare class NoopInvoiceProvider implements InvoiceProvider {
    config: {
        code: string;
        name: string;
    };
    issue(): Promise<IssueInvoiceResult>;
    reverse(): Promise<ReverseInvoiceResult>;
    queryPdf(): Promise<QueryPdfResult>;
}
