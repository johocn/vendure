"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alipayPaymentHandler = void 0;
const core_1 = require("@vendure/core");
const alipay_sdk_1 = require("alipay-sdk");
const constants_1 = require("./constants");
exports.alipayPaymentHandler = new core_1.PaymentMethodHandler({
    code: 'alipay',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '支付宝支付' },
        { languageCode: core_1.LanguageCode.zh_Hant, value: '支付寶支付' },
        { languageCode: core_1.LanguageCode.en, value: 'Alipay' },
    ],
    args: {
        appId: {
            type: 'string',
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '应用ID (appId)' }],
        },
        privateKey: {
            type: 'string',
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '应用私钥' }],
        },
        tradeType: {
            type: 'string',
            defaultValue: 'PAGE',
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '交易类型 (PAGE/WAP)' }],
        },
    },
    async createPayment(ctx, order, amount, args, metadata, method) {
        var _a, _b;
        try {
            const alipaySdk = new alipay_sdk_1.AlipaySdk({
                appId: args.appId,
                privateKey: args.privateKey,
                signType: 'RSA2',
            });
            const notifyUrl = ((_a = method.customFields) === null || _a === void 0 ? void 0 : _a.notifyUrl) || '';
            const returnUrl = ((_b = method.customFields) === null || _b === void 0 ? void 0 : _b.returnUrl) || '';
            const isWap = args.tradeType === 'WAP';
            const apiMethod = isWap ? 'alipay.trade.wap.pay' : 'alipay.trade.page.pay';
            const productCode = isWap ? 'QUICK_WAP_WAY' : 'FAST_INSTANT_TRADE_PAY';
            const payForm = alipaySdk.pageExec(apiMethod, 'POST', {
                bizContent: {
                    out_trade_no: order.code,
                    total_amount: (amount / 100).toFixed(2),
                    subject: `Order ${order.code}`,
                    product_code: productCode,
                },
                notifyUrl,
                returnUrl,
            });
            return {
                amount,
                state: 'Authorized',
                transactionId: `ALIPAY-${order.code}`,
                metadata: {
                    payForm,
                    payType: isWap ? 'wap' : 'page',
                },
            };
        }
        catch (e) {
            core_1.Logger.error(`Alipay createPayment failed: ${e.message}`, constants_1.loggerCtx);
            return {
                amount,
                state: 'Declined',
                errorMessage: e.message,
                metadata: {},
            };
        }
    },
    async settlePayment(ctx, order, payment, args) {
        return { success: true };
    },
    async createRefund(ctx, input, amount, order, payment, args, method) {
        try {
            const alipaySdk = new alipay_sdk_1.AlipaySdk({
                appId: args.appId,
                privateKey: args.privateKey,
                signType: 'RSA2',
            });
            const result = await alipaySdk.exec('alipay.trade.refund', {
                bizContent: {
                    out_trade_no: order.code,
                    refund_amount: (amount / 100).toFixed(2),
                    out_request_no: `REFUND-${payment.id}-${Date.now()}`,
                },
            });
            if (result.code === '10000') {
                return {
                    state: 'Settled',
                    transactionId: payment.transactionId,
                    metadata: result,
                };
            }
            return {
                state: 'Failed',
                transactionId: payment.transactionId,
                metadata: result,
            };
        }
        catch (e) {
            core_1.Logger.error(`Alipay refund failed: ${e.message}`, constants_1.loggerCtx);
            return {
                state: 'Failed',
                metadata: { errorMessage: e.message },
            };
        }
    },
});
//# sourceMappingURL=alipay-handler.js.map