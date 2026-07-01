interface InvoiceData {
    invoiceNumber: string;
    invoiceType: string;
    invoiceTitle: string;
    invoiceTaxNumber: string;
    invoiceEmail: string;
    orderCode: string;
    orderTotal: number;
    currencyCode: string;
    orderDate: string;
    lines: Array<{
        name: string;
        quantity: number;
        price: number;
    }>;
}
export declare function generateOrdinaryInvoice(data: InvoiceData): Promise<Buffer>;
export {};
