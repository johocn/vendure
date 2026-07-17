"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoopInvoiceProvider = void 0;
class NoopInvoiceProvider {
    constructor() {
        this.config = { code: 'noop', name: 'Noop (未配置)' };
    }
    async issue() {
        return { success: true, invoiceNo: 'NOOP-' + Date.now(), pdfUrl: undefined };
    }
    async reverse() {
        return { success: true };
    }
    async queryPdf() {
        return { pdfUrl: undefined };
    }
}
exports.NoopInvoiceProvider = NoopInvoiceProvider;
//# sourceMappingURL=invoice-provider.js.map