"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWechatpayHandler = createWechatpayHandler;
const core_1 = require("@vendure/core");
const wechatpay_node_v3_1 = __importDefault(require("wechatpay-node-v3"));
const constants_1 = require("./constants");
function createWechatpayHandler(options) {
    return new core_1.PaymentMethodHandler({
        code: 'wechatpay',
        description: [
            { languageCode: core_1.LanguageCode.zh_Hans, value: '微信支付' },
            { languageCode: core_1.LanguageCode.zh_Hant, value: '微信支付' },
            { languageCode: core_1.LanguageCode.en, value: 'WeChat Pay' },
        ],
        args: {
            appId: {
                type: 'string',
                label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '应用ID (appId)' }],
            },
            mchId: {
                type: 'string',
                label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '商户号 (mchId)' }],
            },
            publicKey: {
                type: 'string',
                label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '微信平台公钥 (PEM)' }],
            },
            privateKey: {
                type: 'string',
                label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '商户私钥 (PEM)' }],
            },
            apiKey: {
                type: 'string',
                label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: 'APIv3密钥' }],
            },
            serialNo: {
                type: 'string',
                label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '证书序列号' }],
            },
            tradeType: {
                type: 'string',
                defaultValue: 'JSAPI',
                label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '交易类型 (JSAPI/NATIVE/APP/H5)' }],
            },
        },
        async createPayment(ctx, order, amount, args, metadata, method) {
            var _a, _b, _c, _d, _e;
            try {
                const pay = new wechatpay_node_v3_1.default({
                    appid: args.appId,
                    mchid: args.mchId,
                    publicKey: Buffer.from(args.publicKey),
                    privateKey: Buffer.from(args.privateKey),
                    key: args.apiKey,
                    serial_no: args.serialNo,
                });
                const tradeType = args.tradeType || 'JSAPI';
                const openid = metadata === null || metadata === void 0 ? void 0 : metadata.openid;
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
                        state: 'Authorized',
                        transactionId: `WECHATPAY-${order.code}`,
                        metadata: {
                            payUrl: (_a = result.data) === null || _a === void 0 ? void 0 : _a.code_url,
                            payType: 'native',
                        },
                    };
                }
                if (tradeType === 'H5') {
                    const result = await pay.transactions_h5(Object.assign(Object.assign({}, baseParams), { scene_info: {
                            payer_client_ip: ((_b = ctx.req) === null || _b === void 0 ? void 0 : _b.ip) || '127.0.0.1',
                            h5_info: { type: 'Wap', app_name: 'Vendure' },
                        } }));
                    return {
                        amount,
                        state: 'Authorized',
                        transactionId: `WECHATPAY-${order.code}`,
                        metadata: {
                            payUrl: (_c = result.data) === null || _c === void 0 ? void 0 : _c.h5_url,
                            payType: 'h5',
                        },
                    };
                }
                if (tradeType === 'APP') {
                    const result = await pay.transactions_app(baseParams);
                    return {
                        amount,
                        state: 'Authorized',
                        transactionId: `WECHATPAY-${order.code}`,
                        metadata: {
                            prepayId: (_d = result.data) === null || _d === void 0 ? void 0 : _d.prepay_id,
                            payType: 'app',
                        },
                    };
                }
                const result = await pay.transactions_jsapi(Object.assign(Object.assign({}, baseParams), { payer: { openid: openid || '' } }));
                return {
                    amount,
                    state: 'Authorized',
                    transactionId: `WECHATPAY-${order.code}`,
                    metadata: {
                        prepayId: (_e = result.data) === null || _e === void 0 ? void 0 : _e.prepay_id,
                        payType: 'jsapi',
                        appId: args.appId,
                    },
                };
            }
            catch (e) {
                core_1.Logger.error(`WeChat Pay createPayment failed: ${e.message}`, constants_1.loggerCtx);
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
                const pay = new wechatpay_node_v3_1.default({
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
                    state: 'Settled',
                    transactionId: payment.transactionId,
                    metadata: result,
                };
            }
            catch (e) {
                core_1.Logger.error(`WeChat Pay refund failed: ${e.message}`, constants_1.loggerCtx);
                return {
                    state: 'Failed',
                    metadata: { errorMessage: e.message },
                };
            }
        },
    });
}
//# sourceMappingURL=wechatpay-handler.js.map