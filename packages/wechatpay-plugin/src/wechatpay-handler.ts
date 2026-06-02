import { LanguageCode, Logger, PaymentMethodHandler } from '@vendure/core';
import WxPay from 'wechatpay-node-v3';

import { loggerCtx } from './constants';
import { WechatpayPluginOptions } from './types';

export function createWechatpayHandler(options: WechatpayPluginOptions) {
    return new PaymentMethodHandler({
        code: 'wechatpay',
        description: [
            { languageCode: LanguageCode.zh_Hans, value: '微信支付' },
            { languageCode: LanguageCode.zh_Hant, value: '微信支付' },
            { languageCode: LanguageCode.en, value: 'WeChat Pay' },
        ],
        args: {
            appId: {
                type: 'string',
                label: [{ languageCode: LanguageCode.zh_Hans, value: '应用ID (appId)' }],
            },
            mchId: {
                type: 'string',
                label: [{ languageCode: LanguageCode.zh_Hans, value: '商户号 (mchId)' }],
            },
            publicKey: {
                type: 'string',
                label: [{ languageCode: LanguageCode.zh_Hans, value: '微信平台公钥 (PEM)' }],
            },
            privateKey: {
                type: 'string',
                label: [{ languageCode: LanguageCode.zh_Hans, value: '商户私钥 (PEM)' }],
            },
            apiKey: {
                type: 'string',
                label: [{ languageCode: LanguageCode.zh_Hans, value: 'APIv3密钥' }],
            },
            serialNo: {
                type: 'string',
                label: [{ languageCode: LanguageCode.zh_Hans, value: '证书序列号' }],
            },
            tradeType: {
                type: 'string',
                defaultValue: 'JSAPI',
                label: [{ languageCode: LanguageCode.zh_Hans, value: '交易类型 (JSAPI/NATIVE/APP/H5)' }],
            },
        },
        async createPayment(ctx, order, amount, args, metadata, method) {
            try {
                const pay = new WxPay({
                    appid: args.appId,
                    mchid: args.mchId,
                    publicKey: Buffer.from(args.publicKey),
                    privateKey: Buffer.from(args.privateKey),
                    key: args.apiKey,
                    serial_no: args.serialNo,
                });

                const tradeType = args.tradeType || 'JSAPI';
                const openid = metadata?.openid as string | undefined;
                const baseParams = {
                    description: `Order ${order.code}`,
                    out_trade_no: order.code,
                    notify_url: options.notifyUrl,
                    amount: {
                        total: Math.round(amount / 100),
                        currency: 'CNY',
                    },
                };

                if (tradeType === 'NATIVE') {
                    const result = await pay.transactions_native(baseParams);
                    return {
                        amount,
                        state: 'Authorized' as const,
                        transactionId: `WECHATPAY-${order.code}`,
                        metadata: {
                            payUrl: (result as any).data?.code_url,
                            payType: 'native',
                        },
                    };
                }

                if (tradeType === 'H5') {
                    const result = await pay.transactions_h5({
                        ...baseParams,
                        scene_info: {
                            payer_client_ip: ctx.req?.ip || '127.0.0.1',
                            h5_info: { type: 'Wap', app_name: 'Vendure' },
                        },
                    });
                    return {
                        amount,
                        state: 'Authorized' as const,
                        transactionId: `WECHATPAY-${order.code}`,
                        metadata: {
                            payUrl: (result as any).data?.h5_url,
                            payType: 'h5',
                        },
                    };
                }

                if (tradeType === 'APP') {
                    const result = await pay.transactions_app(baseParams);
                    return {
                        amount,
                        state: 'Authorized' as const,
                        transactionId: `WECHATPAY-${order.code}`,
                        metadata: {
                            prepayId: (result as any).data?.prepay_id,
                            payType: 'app',
                        },
                    };
                }

                const result = await pay.transactions_jsapi({
                    ...baseParams,
                    payer: { openid: openid || '' },
                });
                return {
                    amount,
                    state: 'Authorized' as const,
                    transactionId: `WECHATPAY-${order.code}`,
                    metadata: {
                        prepayId: (result as any).data?.prepay_id,
                        payType: 'jsapi',
                        appId: args.appId,
                    },
                };
            } catch (e: any) {
                Logger.error(`WeChat Pay createPayment failed: ${e.message}`, loggerCtx);
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
                const pay = new WxPay({
                    appid: args.appId,
                    mchid: args.mchId,
                    publicKey: Buffer.from(args.publicKey),
                    privateKey: Buffer.from(args.privateKey),
                    key: args.apiKey,
                    serial_no: args.serialNo,
                });

                const result = await pay.refunds({
                    out_trade_no: order.code,
                    out_refund_no: `REFUND-${payment.id}-${Date.now()}`,
                    amount: {
                        refund: Math.round(amount / 100),
                        total: Math.round(payment.amount / 100),
                        currency: 'CNY',
                    },
                });

                return {
                    state: 'Settled' as const,
                    transactionId: payment.transactionId,
                    metadata: result,
                };
            } catch (e: any) {
                Logger.error(`WeChat Pay refund failed: ${e.message}`, loggerCtx);
                return {
                    state: 'Failed' as const,
                    metadata: { errorMessage: e.message },
                };
            }
        },
    });
}
