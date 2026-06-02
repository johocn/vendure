import { LanguageCode, Logger, PaymentMethodHandler } from '@vendure/core';
import { AlipaySdk } from 'alipay-sdk';

import { loggerCtx } from './constants';

export const alipayPaymentHandler = new PaymentMethodHandler({
    code: 'alipay',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '支付宝支付' },
        { languageCode: LanguageCode.zh_Hant, value: '支付寶支付' },
        { languageCode: LanguageCode.en, value: 'Alipay' },
    ],
    args: {
        appId: {
            type: 'string',
            label: [{ languageCode: LanguageCode.zh_Hans, value: '应用ID (appId)' }],
        },
        privateKey: {
            type: 'string',
            label: [{ languageCode: LanguageCode.zh_Hans, value: '应用私钥' }],
        },
        tradeType: {
            type: 'string',
            defaultValue: 'PAGE',
            label: [{ languageCode: LanguageCode.zh_Hans, value: '交易类型 (PAGE/WAP)' }],
        },
    },
    async createPayment(ctx, order, amount, args, metadata, method) {
        try {
            const alipaySdk = new AlipaySdk({
                appId: args.appId,
                privateKey: args.privateKey,
                signType: 'RSA2',
            });

            const notifyUrl = (method as any).customFields?.notifyUrl || '';
            const returnUrl = (method as any).customFields?.returnUrl || '';

            const isWap = args.tradeType === 'WAP';
            const apiMethod = isWap ? 'alipay.trade.wap.pay' : 'alipay.trade.page.pay';
            const productCode = isWap ? 'QUICK_WAP_WAY' : 'FAST_INSTANT_TRADE_PAY';

            const payForm = alipaySdk.pageExec(
                apiMethod,
                'POST',
                {
                    bizContent: {
                        out_trade_no: order.code,
                        total_amount: (amount / 100).toFixed(2),
                        subject: `Order ${order.code}`,
                        product_code: productCode,
                    },
                    notifyUrl,
                    returnUrl,
                },
            );

            return {
                amount,
                state: 'Authorized' as const,
                transactionId: `ALIPAY-${order.code}`,
                metadata: {
                    payForm,
                    payType: isWap ? 'wap' : 'page',
                },
            };
        } catch (e: any) {
            Logger.error(`Alipay createPayment failed: ${e.message}`, loggerCtx);
            return {
                amount,
                state: 'Declined' as const,
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
            const alipaySdk = new AlipaySdk({
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

            if ((result as any).code === '10000') {
                return {
                    state: 'Settled' as const,
                    transactionId: payment.transactionId,
                    metadata: result,
                };
            }

            return {
                state: 'Failed' as const,
                transactionId: payment.transactionId,
                metadata: result,
            };
        } catch (e: any) {
            Logger.error(`Alipay refund failed: ${e.message}`, loggerCtx);
            return {
                state: 'Failed' as const,
                metadata: { errorMessage: e.message },
            };
        }
    },
});
