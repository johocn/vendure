interface CombinedInvoiceData {
    invoiceNumber: string;
    invoiceType: string;
    invoiceTitle: string;
    invoiceTaxNumber: string;
    invoiceEmail: string;
    invoiceCompanyAddress: string;
    invoiceCompanyPhone: string;
    invoiceBankName: string;
    invoiceBankAccount: string;
    orderCodes: string[];
    orderTotal: number;
    currencyCode: string;
    orderDate: string;
    items: Array<{
        orderCode: string;
        name: string;
        quantity: number;
        price: number;
    }>;
}
export declare function generateCombinedInvoice(data: CombinedInvoiceData): Promise<Buffer>;
export {};
