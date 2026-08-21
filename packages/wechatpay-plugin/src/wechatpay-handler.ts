import { LanguageCode, Logger, PaymentMethodHandler } from '@vendure/core';
import WxPay from 'wechatpay-node-v3';
import crypto from 'crypto';
import { getPaymentOverride } from '@vendure/cjk-plugin';
import type { WechatpayCredentials } from '@vendure/cjk-plugin';

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
                // Dev Bypass: 跳过真实微信 API 调用，返回模拟支付页面链接
                // 注意：Shop API 的 Payment.metadata 字段 resolver 只返回 metadata.public
                // (见 payment-entity.resolver.ts)，所以支付参数必须嵌套在 public 字段下
                // 
                // 分期支持：微信支付分付（Installment）是消费者侧功能，
                // 商户需在微信支付商户平台开通分付产品，用户端自动展示分期选项。
                // 商户无需在 createPayment 中传递额外分期参数。
                if (options?.devBypass) {
                    const devPayUrl = `/wechatpay/dev-pay?orderCode=${order.code}`;
                    return {
                        amount,
                        state: 'Authorized' as const,
                        transactionId: `DEV-WECHATPAY-${order.code}`,
                        metadata: {
                            public: {
                                payUrl: devPayUrl,
                                payType: 'dev-h5',
                            },
                        },
                    };
                }

                const override = getPaymentOverride(ctx, 'wechatpay') as WechatpayCredentials | null;
                const pay = new WxPay({
                    appid: override?.appId || args.appId,
                    mchid: override?.mchId || args.mchId,
                    publicKey: Buffer.from(override?.publicKey || args.publicKey),
                    privateKey: Buffer.from(override?.privateKey || args.privateKey),
                    key: override?.apiKey || args.apiKey,
                    serial_no: override?.serialNo || args.serialNo,
                });

                const tradeType = override?.tradeType || args.tradeType || 'JSAPI';
                const openid = (metadata?.openid as string | undefined) || options?.devBypassOpenid;
                const baseParams = {
                    description: `Order ${order.code}`,
                    out_trade_no: order.code,
                    notify_url: options?.notifyUrl || '',
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
                            public: {
                                payUrl: (result as any).data?.code_url,
                                payType: 'native',
                            },
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
                            public: {
                                payUrl: (result as any).data?.h5_url,
                                payType: 'h5',
                            },
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
                            public: {
                                prepayId: (result as any).data?.prepay_id,
                                payType: 'app',
                            },
                        },
                    };
                }

                // JSAPI: 生成完整签名参数供前端 wx.requestPayment 直接调用
                const result = await pay.transactions_jsapi({
                    ...baseParams,
                    payer: { openid: openid || '' },
                });
                const prepayId = (result as any).data?.prepay_id;
                const jsapiAppId = override?.appId || args.appId;
                const jsapiTimeStamp = String(Math.floor(Date.now() / 1000));
                const jsapiNonceStr = Math.random().toString(36).substring(2, 34);
                const jsapiPackage = `prepay_id=${prepayId}`;

                // 商户私钥 RSA-SHA256 签名
                const privateKeyBuf = Buffer.from(override?.privateKey || args.privateKey);
                const signContent = `${jsapiAppId}\n${jsapiTimeStamp}\n${jsapiNonceStr}\n${jsapiPackage}\n`;
                const paySign = crypto
                    .sign('RSA-SHA256', Buffer.from(signContent), { key: privateKeyBuf })
                    .toString('base64');

                return {
                    amount,
                    state: 'Authorized' as const,
                    transactionId: `WECHATPAY-${order.code}`,
                    metadata: {
                        public: {
                            prepayId,
                            payType: 'jsapi',
                            appId: jsapiAppId,
                            timeStamp: jsapiTimeStamp,
                            nonceStr: jsapiNonceStr,
                            package: jsapiPackage,
                            signType: 'RSA',
                            paySign,
                        },
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
                // 退款使用多租户凭证 override，与 createPayment 保持一致
                const override = getPaymentOverride(ctx, 'wechatpay') as WechatpayCredentials | null;
                const pay = new WxPay({
                    appid: override?.appId || args.appId,
                    mchid: override?.mchId || args.mchId,
                    publicKey: Buffer.from(override?.publicKey || args.publicKey),
                    privateKey: Buffer.from(override?.privateKey || args.privateKey),
                    key: override?.apiKey || args.apiKey,
                    serial_no: override?.serialNo || args.serialNo,
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
