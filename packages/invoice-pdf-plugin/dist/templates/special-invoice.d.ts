interface SpecialInvoiceData {
    invoiceNumber: string;
    invoiceTitle: string;
    invoiceTaxNumber: string;
    invoiceEmail: string;
    invoiceCompanyAddress: string;
    invoiceCompanyPhone: string;
    invoiceBankName: string;
    invoiceBankAccount: string;
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
export declare function generateSpecialInvoice(data: SpecialInvoiceData): Promise<Buffer>;
export {};
