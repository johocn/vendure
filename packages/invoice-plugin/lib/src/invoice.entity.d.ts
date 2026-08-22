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
    FAILED = "failed",
    /** 已作废（未开/失败的票，作废留痕），作废后可重开同一订单 */
    VOIDED = "voided",
    /** 已部分红冲（原票保留，存在关联红字票） */
    PARTIALLY_REVERSED = "partially_reversed"
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
    /** 作废留痕时间（VOIDED） */
    voidedAt?: Date;
    /** 作废留痕原因（VOIDED） */
    voidReason: string | null;
    /** 关联父（蓝）票 ID：红字票/部分红冲生成的红字票指向原票 */
    parentInvoiceId?: number;
    /** 是否红字（作废/红冲生成的红字票，amount 为负数） */
    isRed: boolean;
    /** 是否已部分红冲（原票保留，存在关联红字票） */
    partiallyReversed: boolean;
    /** 已累计红冲金额（分，仅原票维护） */
    reversedAmount?: number;
    providerInvoiceNo: string | null;
    lastError: string | null;
    channels: Channel[];
}
