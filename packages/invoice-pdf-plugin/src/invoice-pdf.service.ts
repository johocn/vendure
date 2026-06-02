import { Injectable } from '@nestjs/common';
import { AssetStorageStrategy, Logger, Order, RequestContext } from '@vendure/core';

import { loggerCtx } from './constants';
import { generateOrdinaryInvoice } from './templates/ordinary-invoice';
import { generateSpecialInvoice } from './templates/special-invoice';

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

    async generateAndStore(
        ctx: RequestContext,
        order: Order,
        assetStorageStrategy: AssetStorageStrategy,
    ): Promise<string> {
        const pdfBuffer = await this.generatePdf(ctx, order);
        const cf = (order as any).customFields;
        const invoiceNumber = cf?.invoiceNumber || `INV-${order.id}-${Date.now()}`;
        const fileName = `invoices/${ctx.channelId}/${order.id}/${invoiceNumber}.pdf`;

        await assetStorageStrategy.writeFileFromBuffer(fileName, pdfBuffer, 'application/pdf');

        Logger.info(`Invoice PDF generated: ${fileName}`, loggerCtx);
        return fileName;
    }
}
