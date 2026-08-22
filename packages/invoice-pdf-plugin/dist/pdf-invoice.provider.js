"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfInvoiceProvider = void 0;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const invoice_pdf_service_1 = require("./invoice-pdf.service");
/**
 * 本地 PDF 开票 Provider：实现 invoice-plugin 的 InvoiceProvider 接口。
 * issue 时按 orderIds 聚合订单行 → 用 combined 模板生成单张 PDF → 存 assets → 回填 pdfUrl。
 * queryPdf 依据 invoiceNo 解析出存储 fileName 并返回可下载 URL；reverse 为本地冲红。
 *
 * 说明：AssetServerPlugin 的 LocalAssetStorageStrategy.toAbsoluteUrl 需要 express Request 且
 * 依赖请求主机，provider 侧拿不到原始请求。故此处按 asset 路由直接生成相对 URL
 * （`{assetRoute}/{fileName}`，如 `assets/invoices/2/INV-xxx.pdf`），同源下可直接访问，前端可加前缀成绝对地址。
 */
class PdfInvoiceProvider {
    constructor(options) {
        var _a;
        this.options = options;
        this.config = { code: 'pdf', name: '自动生成PDF' };
        this.invoicePdfService = null;
        this.orderService = null;
        this.assetStorageStrategy = null;
        this.assetRoute = 'assets';
        if ((_a = this.options) === null || _a === void 0 ? void 0 : _a.assetRoute) {
            this.assetRoute = this.options.assetRoute.replace(/^\/+|\/+$/g, '');
        }
    }
    init(injector) {
        this.invoicePdfService = injector.get(invoice_pdf_service_1.InvoicePdfService);
        this.orderService = injector.get(core_1.OrderService);
        const { assetStorageStrategy } = injector.get(core_1.ConfigService).assetOptions;
        this.assetStorageStrategy = assetStorageStrategy;
        core_1.Logger.info('PdfInvoiceProvider initialized', constants_1.loggerCtx);
    }
    async issue(ctx, input) {
        var _a;
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
        // 直接复用业务层统一发票号（INV-{yyyyMMdd}-{channelId}-{seq}），保证 admin/前台一致
        const invoiceNo = (_a = input.invoiceNo) !== null && _a !== void 0 ? _a : `INV-${this.channelId(ctx)}-${orderIds.join('_')}-${Date.now()}`;
        const buffer = await this.invoicePdfService.generateCombinedPdf(ctx, Object.assign(Object.assign({}, input), { invoiceNo }), orders);
        const fileName = `invoices/${this.channelId(ctx)}/${invoiceNo}.pdf`;
        await this.assetStorageStrategy.writeFileFromBuffer(fileName, buffer);
        const pdfUrl = this.toAbsoluteUrl(fileName);
        core_1.Logger.info(`Invoice PDF issued: ${invoiceNo} -> ${pdfUrl}`, constants_1.loggerCtx);
        return { success: true, invoiceNo, pdfUrl };
    }
    async reverse() {
        // 本地冲红：不涉及第三方税局，直接返回成功（状态反转由 invoice-plugin 处理）
        return { success: true };
    }
    async queryPdf(ctx, invoiceNo) {
        if (!this.assetStorageStrategy) {
            return { error: 'PdfInvoiceProvider not initialized' };
        }
        const fileName = `invoices/${this.channelId(ctx)}/${invoiceNo}.pdf`;
        try {
            if (this.assetStorageStrategy && this.assetStorageStrategy.fileExists && !(await this.assetStorageStrategy.fileExists(fileName))) {
                return { error: `PDF not found for invoiceNo ${invoiceNo}` };
            }
            return { pdfUrl: this.toAbsoluteUrl(fileName) };
        }
        catch (e) {
            return { error: e.message };
        }
    }
    channelId(ctx) {
        return String(ctx.channelId);
    }
    toAbsoluteUrl(fileName) {
        // 按 asset 路由生成相对 URL（AssetServerPlugin route，默认 assets）。
        return `${this.assetRoute}/${fileName}`;
    }
}
exports.PdfInvoiceProvider = PdfInvoiceProvider;
