import PDFDocument from 'pdfkit';

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
    items: Array<{ orderCode: string; name: string; quantity: number; price: number }>;
}

export function generateCombinedInvoice(data: CombinedInvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const heading = data.invoiceType === 'special' ? 'VAT SPECIAL INVOICE' : 'INVOICE';
        doc.fontSize(20).text(heading, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`No: ${data.invoiceNumber}`, { align: 'center' });
        doc.moveDown(1);

        doc.fontSize(10);
        doc.text(`Type: ${data.invoiceType}`);
        doc.text(`Title: ${data.invoiceTitle}`);
        doc.text(`Tax Number: ${data.invoiceTaxNumber}`);
        doc.text(`Email: ${data.invoiceEmail}`);
        if (data.invoiceCompanyAddress) {
            doc.text(`Company Address: ${data.invoiceCompanyAddress}`);
        }
        if (data.invoiceCompanyPhone) {
            doc.text(`Company Phone: ${data.invoiceCompanyPhone}`);
        }
        if (data.invoiceBankName) {
            doc.text(`Bank: ${data.invoiceBankName}`);
        }
        if (data.invoiceBankAccount) {
            doc.text(`Bank Account: ${data.invoiceBankAccount}`);
        }
        doc.moveDown(0.5);
        doc.text(`Orders: ${data.orderCodes.join(', ')}`);
        doc.text(`Date: ${data.orderDate}`);
        doc.moveDown(1);

        doc.text('Items:', { underline: true });
        doc.moveDown(0.3);
        for (const line of data.items) {
            doc.text(`${line.name}  x${line.quantity}  ${line.price}  [${line.orderCode}]`);
        }
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Total: ${data.currencyCode} ${(data.orderTotal / 100).toFixed(2)}`, { align: 'right' });

        doc.end();
    });
}