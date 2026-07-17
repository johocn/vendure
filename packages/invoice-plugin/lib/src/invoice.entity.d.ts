import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
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
    orderIds: number[];
    pdfUrl: string | null;
    issuedAt: Date;
    reversedAt: Date;
    reverseReason: string | null;
    providerInvoiceNo: string | null;
    lastError: string | null;
    channels: Channel[];
}
