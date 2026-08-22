import { Injector, RequestContext } from '@vendure/core';
import { InvoiceProvider, InvoiceProviderConfig, IssueInvoiceInput, IssueInvoiceResult, QueryPdfResult, ReverseInvoiceResult } from '@vendure/invoice-plugin';
/**
 * 本地 PDF 开票 Provider：实现 invoice-plugin 的 InvoiceProvider 接口。
 * issue 时按 orderIds 聚合订单行 → 用 combined 模板生成单张 PDF → 存 assets → 回填 pdfUrl。
 * queryPdf 依据 invoiceNo 解析出存储 fileName 并返回可下载 URL；reverse 为本地冲红。
 *
 * 说明：AssetServerPlugin 的 LocalAssetStorageStrategy.toAbsoluteUrl 需要 express Request 且
 * 依赖请求主机，provider 侧拿不到原始请求。故此处按 asset 路由直接生成相对 URL
 * （`{assetRoute}/{fileName}`，如 `assets/invoices/2/INV-xxx.pdf`），同源下可直接访问，前端可加前缀成绝对地址。
 */
export declare class PdfInvoiceProvider implements InvoiceProvider {
    private options?;
    config: InvoiceProviderConfig;
    private invoicePdfService;
    private orderService;
    private assetStorageStrategy;
    private assetRoute;
    constructor(options?: {
        assetRoute?: string;
    } | undefined);
    init(injector: Injector): void;
    issue(ctx: RequestContext, input: IssueInvoiceInput): Promise<IssueInvoiceResult>;
    reverse(): Promise<ReverseInvoiceResult>;
    queryPdf(ctx: RequestContext, invoiceNo: string): Promise<QueryPdfResult>;
    private channelId;
    private toAbsoluteUrl;
}
