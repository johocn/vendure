import { Injectable } from '@nestjs/common';
import { AssetStorageStrategy, Logger, Order, RequestContext } from '@vendure/core';
import type { IssueInvoiceInput } from '@vendure/invoice-plugin';

import { loggerCtx } from './constants';
import { generateOrdinaryInvoice } from './templates/ordinary-invoice';
import { generateSpecialInvoice } from './templates/special-invoice';
import { generateCombinedInvoice } from './templates/combined';

@Injectable()
export class InvoicePdfService {
    async generatePdf(ctx: RequestContext, order: Order): Promise<Buffer> {
        const cf = (order as any).customFields;
        const invoiceNumber = cf?.invoiceNumber || `INV-${order.id}-${Date.now()}`;

        const lines = (order.lines ?? []).map((line: any) => ({
            name: line.productVariant?.name || 'Item',
            quantity: line.quantity,
            price: (line.proratedLinePriceWithTax ?? 0) / 100,
        }));

        if (cf?.invoiceType === 'special') {
            return generateSpecialInvoice({
                invoiceNumber,
                invoiceTitle: cf.invoiceTitle || '',
                invoiceTaxNumber: cf.invoiceTaxNumber || '',
                invoiceEmail: cf.invoiceEmail || '',
                invoiceCompanyAddress: cf.invoiceCompanyAddress || '',
                invoiceCompanyPhone: cf.invoiceCompanyPhone || '',
                invoiceBankName: cf.invoiceBankName || '',
                invoiceBankAccount: cf.invoiceBankAccount || '',
                orderCode: order.code,
                orderTotal: order.totalWithTax ?? 0,
                currencyCode: order.currencyCode ?? 'CNY',
                orderDate: order.orderPlacedAt?.toISOString() ?? '',
                lines,
            });
        }

        return generateOrdinaryInvoice({
            invoiceNumber,
            invoiceType: cf?.invoiceType || 'ordinary',
            invoiceTitle: cf?.invoiceTitle || '',
            invoiceTaxNumber: cf?.invoiceTaxNumber || '',
            invoiceEmail: cf?.invoiceEmail || '',
            orderCode: order.code,
            orderTotal: order.totalWithTax ?? 0,
            currencyCode: order.currencyCode ?? 'CNY',
            orderDate: order.orderPlacedAt?.toISOString() ?? '',
            lines,
        });
    }

    async generateCombinedPdf(
        ctx: RequestContext,
        input: IssueInvoiceInput & { invoiceNo: string },
        orders: Order[],
    ): Promise<Buffer> {
        const items: Array<{ orderCode: string; name: string; quantity: number; price: number }> = [];
        let orderTotal = 0;
        let orderDate = '';
        for (const order of orders) {
            orderTotal += order.totalWithTax ?? 0;
            if (!orderDate && order.orderPlacedAt) {
                orderDate = order.orderPlacedAt.toISOString();
            }
            for (const line of order.lines ?? []) {
                items.push({
                    orderCode: order.code,
                    name: (line as any).productVariant?.name || 'Item',
                    quantity: line.quantity,
                    price: (line.proratedLinePriceWithTax ?? 0) / 100,
                });
            }
        }

        return generateCombinedInvoice({
            invoiceNumber: input.invoiceNo,
            invoiceType: input.invoiceType,
            invoiceTitle: input.title,
            invoiceTaxNumber: input.taxNumber ?? '',
            invoiceEmail: input.email ?? '',
            invoiceCompanyAddress: input.companyAddress ?? '',
            invoiceCompanyPhone: input.companyPhone ?? '',
            invoiceBankName: input.bankName ?? '',
            invoiceBankAccount: input.bankAccount ?? '',
            orderCodes: orders.map(o => o.code),
            orderTotal,
            currencyCode: orders[0]?.currencyCode ?? 'CNY',
            orderDate,
            items,
        });
    }

    async generateAndStore(
        ctx: RequestContext,
        order: Order,
        assetStorageStrategy: AssetStorageStrategy,
    ): Promise<string> {
        const pdfBuffer = await this.generatePdf(ctx, order);
        const cf = (order as any).customFields;
        const invoiceNumber = cf?.invoiceNumber || `INV-${order.id}-${Date.now()}`;
        const fileName = `invoices/${String(ctx.channelId)}/${String(order.id)}/${String(invoiceNumber)}.pdf`;

        await assetStorageStrategy.writeFileFromBuffer(fileName, pdfBuffer);

        Logger.info(`Invoice PDF generated: ${fileName}`, loggerCtx);
        return fileName;
    }
}
