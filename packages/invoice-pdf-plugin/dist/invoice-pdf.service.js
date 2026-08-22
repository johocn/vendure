"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoicePdfService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const ordinary_invoice_1 = require("./templates/ordinary-invoice");
const special_invoice_1 = require("./templates/special-invoice");
const combined_1 = require("./templates/combined");
let InvoicePdfService = class InvoicePdfService {
    async generatePdf(ctx, order) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const cf = order.customFields;
        const invoiceNumber = (cf === null || cf === void 0 ? void 0 : cf.invoiceNumber) || `INV-${order.id}-${Date.now()}`;
        const lines = ((_a = order.lines) !== null && _a !== void 0 ? _a : []).map((line) => {
            var _a, _b;
            return ({
                name: ((_a = line.productVariant) === null || _a === void 0 ? void 0 : _a.name) || 'Item',
                quantity: line.quantity,
                price: ((_b = line.proratedLinePriceWithTax) !== null && _b !== void 0 ? _b : 0) / 100,
            });
        });
        if ((cf === null || cf === void 0 ? void 0 : cf.invoiceType) === 'special') {
            return (0, special_invoice_1.generateSpecialInvoice)({
                invoiceNumber,
                invoiceTitle: cf.invoiceTitle || '',
                invoiceTaxNumber: cf.invoiceTaxNumber || '',
                invoiceEmail: cf.invoiceEmail || '',
                invoiceCompanyAddress: cf.invoiceCompanyAddress || '',
                invoiceCompanyPhone: cf.invoiceCompanyPhone || '',
                invoiceBankName: cf.invoiceBankName || '',
                invoiceBankAccount: cf.invoiceBankAccount || '',
                orderCode: order.code,
                orderTotal: (_b = order.totalWithTax) !== null && _b !== void 0 ? _b : 0,
                currencyCode: (_c = order.currencyCode) !== null && _c !== void 0 ? _c : 'CNY',
                orderDate: (_e = (_d = order.orderPlacedAt) === null || _d === void 0 ? void 0 : _d.toISOString()) !== null && _e !== void 0 ? _e : '',
                lines,
            });
        }
        return (0, ordinary_invoice_1.generateOrdinaryInvoice)({
            invoiceNumber,
            invoiceType: (cf === null || cf === void 0 ? void 0 : cf.invoiceType) || 'ordinary',
            invoiceTitle: (cf === null || cf === void 0 ? void 0 : cf.invoiceTitle) || '',
            invoiceTaxNumber: (cf === null || cf === void 0 ? void 0 : cf.invoiceTaxNumber) || '',
            invoiceEmail: (cf === null || cf === void 0 ? void 0 : cf.invoiceEmail) || '',
            orderCode: order.code,
            orderTotal: (_f = order.totalWithTax) !== null && _f !== void 0 ? _f : 0,
            currencyCode: (_g = order.currencyCode) !== null && _g !== void 0 ? _g : 'CNY',
            orderDate: (_j = (_h = order.orderPlacedAt) === null || _h === void 0 ? void 0 : _h.toISOString()) !== null && _j !== void 0 ? _j : '',
            lines,
        });
    }
    async generateCombinedPdf(ctx, input, orders) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const items = [];
        let orderTotal = 0;
        let orderDate = '';
        for (const order of orders) {
            orderTotal += (_a = order.totalWithTax) !== null && _a !== void 0 ? _a : 0;
            if (!orderDate && order.orderPlacedAt) {
                orderDate = order.orderPlacedAt.toISOString();
            }
            for (const line of (_b = order.lines) !== null && _b !== void 0 ? _b : []) {
                items.push({
                    orderCode: order.code,
                    name: ((_c = line.productVariant) === null || _c === void 0 ? void 0 : _c.name) || 'Item',
                    quantity: line.quantity,
                    price: ((_d = line.proratedLinePriceWithTax) !== null && _d !== void 0 ? _d : 0) / 100,
                });
            }
        }
        return (0, combined_1.generateCombinedInvoice)({
            invoiceNumber: input.invoiceNo,
            invoiceType: input.invoiceType,
            invoiceTitle: input.title,
            invoiceTaxNumber: (_e = input.taxNumber) !== null && _e !== void 0 ? _e : '',
            invoiceEmail: (_f = input.email) !== null && _f !== void 0 ? _f : '',
            invoiceCompanyAddress: (_g = input.companyAddress) !== null && _g !== void 0 ? _g : '',
            invoiceCompanyPhone: (_h = input.companyPhone) !== null && _h !== void 0 ? _h : '',
            invoiceBankName: (_j = input.bankName) !== null && _j !== void 0 ? _j : '',
            invoiceBankAccount: (_k = input.bankAccount) !== null && _k !== void 0 ? _k : '',
            orderCodes: orders.map(o => o.code),
            orderTotal,
            currencyCode: (_m = (_l = orders[0]) === null || _l === void 0 ? void 0 : _l.currencyCode) !== null && _m !== void 0 ? _m : 'CNY',
            orderDate,
            items,
        });
    }
    async generateAndStore(ctx, order, assetStorageStrategy) {
        const pdfBuffer = await this.generatePdf(ctx, order);
        const cf = order.customFields;
        const invoiceNumber = (cf === null || cf === void 0 ? void 0 : cf.invoiceNumber) || `INV-${order.id}-${Date.now()}`;
        const fileName = `invoices/${String(ctx.channelId)}/${String(order.id)}/${String(invoiceNumber)}.pdf`;
        await assetStorageStrategy.writeFileFromBuffer(fileName, pdfBuffer);
        core_1.Logger.info(`Invoice PDF generated: ${fileName}`, constants_1.loggerCtx);
        return fileName;
    }
};
exports.InvoicePdfService = InvoicePdfService;
exports.InvoicePdfService = InvoicePdfService = __decorate([
    (0, common_1.Injectable)()
], InvoicePdfService);
