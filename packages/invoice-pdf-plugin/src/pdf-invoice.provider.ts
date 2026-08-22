import { ConfigService, Injector, Logger, OrderService, RequestContext } from '@vendure/core';
import {
    InvoiceProvider,
    InvoiceProviderConfig,
    IssueInvoiceInput,
    IssueInvoiceResult,
    QueryPdfResult,
    ReverseInvoiceResult,
} from '@vendure/invoice-plugin';

import { loggerCtx } from './constants';
import { InvoicePdfService } from './invoice-pdf.service';

/**
 * 本地 PDF 开票 Provider：实现 invoice-plugin 的 InvoiceProvider 接口。
 * issue 时按 orderIds 聚合订单行 → 用 combined 模板生成单张 PDF → 存 assets → 回填 pdfUrl。
 * queryPdf 依据 invoiceNo 解析出存储 fileName 并返回可下载 URL；reverse 为本地冲红。
 *
 * 说明：AssetServerPlugin 的 LocalAssetStorageStrategy.toAbsoluteUrl 需要 express Request 且
 * 依赖请求主机，provider 侧拿不到原始请求。故此处按 asset 路由直接生成相对 URL
 * （`{assetRoute}/{fileName}`，如 `assets/invoices/2/INV-xxx.pdf`），同源下可直接访问，前端可加前缀成绝对地址。
 */
export class PdfInvoiceProvider implements InvoiceProvider {
    config: InvoiceProviderConfig = { code: 'pdf', name: '自动生成PDF' };

    private invoicePdfService: InvoicePdfService | null = null;
    private orderService: OrderService | null = null;
    private assetStorageStrategy: { fileExists?: (key: string) => Promise<boolean> } | null = null;
    private assetRoute = 'assets';

    constructor(private options?: { assetRoute?: string }) {
        if (this.options?.assetRoute) {
            this.assetRoute = this.options.assetRoute.replace(/^\/+|\/+$/g, '');
        }
    }

    init(injector: Injector): void {
        this.invoicePdfService = injector.get(InvoicePdfService);
        this.orderService = injector.get(OrderService);
        const { assetStorageStrategy } = injector.get(ConfigService).assetOptions;
        this.assetStorageStrategy = assetStorageStrategy as any;
        Logger.info('PdfInvoiceProvider initialized', loggerCtx);
    }

    async issue(ctx: RequestContext, input: IssueInvoiceInput): Promise<IssueInvoiceResult> {
        if (!this.invoicePdfService || !this.orderService || !this.assetStorageStrategy) {
            throw new Error('PdfInvoiceProvider not initialized');
        }
        const orders = [];
        for (const orderId of input.orderIds) {
            const order = await this.orderService.findOne(ctx, orderId, ['lines', 'lines.productVariant']);
            if (!order) {
                return { success: false, error: `Order ${orderId} not found` };
            }
            orders.push(order);
        }

        const orderIds = input.orderIds.slice().sort((a, b) => Number(a) - Number(b));
        const invoiceNo = `INV-${this.channelId(ctx)}-${orderIds.join('_')}-${Date.now()}`;

        const buffer = await this.invoicePdfService.generateCombinedPdf(
            ctx,
            { ...input, invoiceNo },
            orders,
        );

        const fileName = `invoices/${this.channelId(ctx)}/${invoiceNo}.pdf`;
        await (this.assetStorageStrategy as any).writeFileFromBuffer(fileName, buffer);

        const pdfUrl = this.toAbsoluteUrl(fileName);
        Logger.info(`Invoice PDF issued: ${invoiceNo} -> ${pdfUrl}`, loggerCtx);
        return { success: true, invoiceNo, pdfUrl };
    }

    async reverse(): Promise<ReverseInvoiceResult> {
        // 本地冲红：不涉及第三方税局，直接返回成功（状态反转由 invoice-plugin 处理）
        return { success: true };
    }

    async queryPdf(ctx: RequestContext, invoiceNo: string): Promise<QueryPdfResult> {
        if (!this.assetStorageStrategy) {
            return { error: 'PdfInvoiceProvider not initialized' };
        }
        const fileName = `invoices/${this.channelId(ctx)}/${invoiceNo}.pdf`;
        try {
            if (this.assetStorageStrategy && this.assetStorageStrategy.fileExists && !(await this.assetStorageStrategy.fileExists(fileName))) {
                return { error: `PDF not found for invoiceNo ${invoiceNo}` };
            }
            return { pdfUrl: this.toAbsoluteUrl(fileName) };
        } catch (e: any) {
            return { error: e.message };
        }
    }

    private channelId(ctx: RequestContext): string {
        return String(ctx.channelId);
    }

    private toAbsoluteUrl(fileName: string): string {
        // 按 asset 路由生成相对 URL（AssetServerPlugin route，默认 assets）。
        return `${this.assetRoute}/${fileName}`;
    }
}