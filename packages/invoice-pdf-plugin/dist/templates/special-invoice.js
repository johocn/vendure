"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSpecialInvoice = generateSpecialInvoice;
const pdfkit_1 = __importDefault(require("pdfkit"));
function generateSpecialInvoice(data) {
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({ size: 'A4', margin: 50 });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        doc.fontSize(20).text('VAT SPECIAL INVOICE', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`No: ${data.invoiceNumber}`, { align: 'center' });
        doc.moveDown(1);
        doc.fontSize(10);
        doc.text(`Title: ${data.invoiceTitle}`);
        doc.text(`Tax Number: ${data.invoiceTaxNumber}`);
        doc.text(`Email: ${data.invoiceEmail}`);
        doc.moveDown(0.5);
        doc.text(`Company Address: ${data.invoiceCompanyAddress}`);
        doc.text(`Company Phone: ${data.invoiceCompanyPhone}`);
        doc.text(`Bank: ${data.invoiceBankName}`);
        doc.text(`Bank Account: ${data.invoiceBankAccount}`);
        doc.moveDown(0.5);
        doc.text(`Order: ${data.orderCode}`);
        doc.text(`Date: ${data.orderDate}`);
        doc.moveDown(1);
        doc.text('Items:', { underline: true });
        doc.moveDown(0.3);
        for (const line of data.lines) {
            doc.text(`${line.name}  x${line.quantity}  ${line.price}`);
        }
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Total: ${data.currencyCode} ${(data.orderTotal / 100).toFixed(2)}`, { align: 'right' });
        doc.end();
    });
}
