import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export type InvoiceTypeValue = 'ordinary' | 'special' | 'electronic';
export declare enum InvoiceType {
    ORDINARY = "ordinary",
    SPECIAL = "special",
    ELECTRONIC = "electronic"
}
export declare enum InvoiceStatus {
    PENDING = "pending",
    ISSUED = "issued",
    REVERSED = "reversed",
    FAILED = "failed"
}
/** 发票行级明细快照（开票时固化，与订单解耦） */
export interface InvoiceLine {
    orderId: number;
    orderCode: string;
    productVariantId?: number;
    sku?: string;
    name: string;
    quantity: number;
    unitPrice: number;
    unitPriceWithTax: number;
    amount: number;
    taxRate: number;
    taxAmount: number;
    amountWithTax: number;
}
/** 价税分离汇总 */
export interface InvoiceTotals {
    totalExcludingTax: number;
    totalTax: number;
    totalWithTax: number;
}
export declare class Invoice extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Invoice>);
    invoiceType: InvoiceType;
    status: InvoiceStatus;
    title: string;
    taxNumber: string;
    email: string;
    companyAddress: string;
    companyPhone: string;
    bankName: string;
    bankAccount: string;
    amount: number;
    customerId: number;
    channelId?: number;
    orderIds: number[];
    /** 行级明细快照（开票时固化，价税分离） */
    lines: InvoiceLine[] | null;
    /** 价税分离汇总（分） */
    totals: InvoiceTotals | null;
    /** 统一发票号（issue 时回填，= providerInvoiceNo） */
    invoiceNo: string | null;
    pdfUrl: string | null;
    issuedAt?: Date;
    reversedAt?: Date;
    reverseReason: string | null;
    providerInvoiceNo: string | null;
    lastError: string | null;
    channels: Channel[];
}
