"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWechatpayHandler = createWechatpayHandler;
const core_1 = require("@vendure/core");
const wechatpay_node_v3_1 = __importDefault(require("wechatpay-node-v3"));
const crypto_1 = __importDefault(require("crypto"));
// 断开模块级循环依赖：cjk → inventory → shop → review → coupon → wechatpay → cjk。
// 顶层 import cjk 主入口会在 inventory 半初始化时把 cjk 提前拉起，cjk 的 providers 数组
// 引用 inventory 未导出的类（undefined），VendurePlugin 装饰即崩溃。改为从叶子模块直接导入。
const payment_config_1 = require("@vendure/cjk-plugin/lib/src/payment/payment-config");
const constants_1 = require("./constants");
const wechatpay_service_1 = require("./wechatpay.service");
/**
 * 微信支付 PaymentMethodHandler 工厂。
 * code 参数化：同一套 args/逻辑可注册多个支付方法
 * （如 wechatpay=小程序、wechatpay-yourbao-h5=公众号JSAPI、wechatpay-youshop-jsapi 等），
 * 每个方法各自持有 appId/商户凭证/notifyUrl，实现分端分支付方案。
 */
function createWechatpayHandler(options, code = 'wechatpay') {
    return new core_1.PaymentMethodHandler({
        code,
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
            notifyUrl: {
                type: 'string',
                label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '回调地址 (notifyUrl，选填，覆盖全局配置)' }],
                description: [
                    { languageCode: core_1.LanguageCode.zh_Hans, value: '微信支付异步通知地址；优先级：渠道 payConfig > 此处 > 全局 env' },
                ],
            },
        },
        async createPayment(ctx, order, amount, args, metadata, method) {
            var _a, _b, _c, _d, _e, _f;
            try {
                // Dev Bypass: 跳过真实微信 API 调用，返回模拟支付页面链接
                // 注意：Shop API 的 Payment.metadata 字段 resolver 只返回 metadata.public
                // (见 payment-entity.resolver.ts)，所以支付参数必须嵌套在 public 字段下
                // 
                // 分期支持：微信支付分付（Installment）是消费者侧功能，
                // 商户需在微信支付商户平台开通分付产品，用户端自动展示分期选项。
                // 商户无需在 createPayment 中传递额外分期参数。
                if (options === null || options === void 0 ? void 0 : options.devBypass) {
                    const devPayUrl = `/wechatpay/dev-pay?orderCode=${order.code}`;
                    return {
                        amount,
                        state: 'Authorized',
                        transactionId: `DEV-WECHATPAY-${order.code}`,
                        metadata: {
                            public: {
                                payUrl: devPayUrl,
                                payType: 'dev-h5',
                            },
                        },
                    };
                }
                const override = (0, payment_config_1.getPaymentOverride)(ctx, 'wechatpay');
                const pay = new wechatpay_node_v3_1.default({
                    appid: (override === null || override === void 0 ? void 0 : override.appId) || args.appId,
                    mchid: (override === null || override === void 0 ? void 0 : override.mchId) || args.mchId,
                    publicKey: Buffer.from((override === null || override === void 0 ? void 0 : override.publicKey) || args.publicKey),
                    privateKey: Buffer.from((override === null || override === void 0 ? void 0 : override.privateKey) || args.privateKey),
                    key: (override === null || override === void 0 ? void 0 : override.apiKey) || args.apiKey,
                    serial_no: (override === null || override === void 0 ? void 0 : override.serialNo) || args.serialNo,
                });
                const tradeType = (override === null || override === void 0 ? void 0 : override.tradeType) || args.tradeType || 'JSAPI';
                // openid 三级回落（F-VS-08）：前端显式传入 → 由客户档案推导 → devBypass 兜底。
                // 前端本地存储可能缺失/过期，服务端按客户档案推导可避免 JSAPI 支付失败。
                // preferMini 语义：默认 PM（code='wechatpay'）绑定小程序 appid，JSAPI 时优先小程序
                // openid；extra PM（公众号 JSAPI，如 wechatpay-yourbao-h5）须用公众号 openid，
                // 否则双 openid 客户会取到小程序 openid 配公众号 appid，微信报「openid和appid不匹配」。
                const openid = (metadata === null || metadata === void 0 ? void 0 : metadata.openid) ||
                    (await (0, wechatpay_service_1.resolveCustomerOpenid)(ctx, order.customerId, {
                        preferMini: tradeType === 'JSAPI' && code === 'wechatpay',
                    })) ||
                    (options === null || options === void 0 ? void 0 : options.devBypassOpenid);
                const baseParams = {
                    description: `Order ${order.code}`,
                    out_trade_no: order.code,
                    // 回调地址四级回落：渠道 payConfig > 本方法 args.notifyUrl > 全局 env
                    notify_url: (override === null || override === void 0 ? void 0 : override.notifyUrl) || args.notifyUrl || (options === null || options === void 0 ? void 0 : options.notifyUrl) || '',
                    amount: {
                        // 单位：Vendure 默认 MoneyStrategy precision=2，handler 收到的
                        // amount 已是「分」（最小货币单位）；微信 V3 的 amount.total 同样
                        // 以「分」计，故直接透传，切勿再 /100（否则少收 100 倍）。
                        total: Math.round(amount),
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
                            public: {
                                payUrl: (_a = result.data) === null || _a === void 0 ? void 0 : _a.code_url,
                                payType: 'native',
                            },
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
                            public: {
                                payUrl: (_c = result.data) === null || _c === void 0 ? void 0 : _c.h5_url,
                                payType: 'h5',
                            },
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
                            public: {
                                prepayId: (_d = result.data) === null || _d === void 0 ? void 0 : _d.prepay_id,
                                payType: 'app',
                            },
                        },
                    };
                }
                // JSAPI: 生成完整签名参数供前端 wx.requestPayment 直接调用
                // openid 空防线：三级回落全落空时提前拒绝（payer.openid 为微信必填参数），
                // 避免打微信 API 吃 400（生产 5:41 ×6 实锤），并给出场景引导；
                // 与下方 !prepayId 分支同为 throw 形态
                if (!openid) {
                    throw new Error('微信 JSAPI 支付需在微信内完成：未获取到用户 openid，请在微信内打开订单页重试');
                }
                const result = await pay.transactions_jsapi(Object.assign(Object.assign({}, baseParams), { payer: { openid } }));
                const prepayId = (_e = result.data) === null || _e === void 0 ? void 0 : _e.prepay_id;
                // 微信失败响应（openid 缺失/不匹配等）不 reject，仅返回 {status,data:{code,message}}；
                // 不校验会产出 prepay_id=undefined 的假签名参数 + 订单假 Authorized（P2 实锤）
                if (!prepayId) {
                    throw new Error(`微信 JSAPI 下单失败(status=${result.status}): ` +
                        JSON.stringify((_f = result.data) !== null && _f !== void 0 ? _f : result).slice(0, 300));
                }
                const jsapiAppId = (override === null || override === void 0 ? void 0 : override.appId) || args.appId;
                const jsapiTimeStamp = String(Math.floor(Date.now() / 1000));
                const jsapiNonceStr = Math.random().toString(36).substring(2, 34);
                const jsapiPackage = `prepay_id=${prepayId}`;
                // 商户私钥 RSA-SHA256 签名：双缺时显式抛业务错误，避免 crypto
                // Buffer.from(undefined) 的晦涩报错「Received undefined」（生产 8:29 实锤）
                const merchantPrivateKey = (override === null || override === void 0 ? void 0 : override.privateKey) || args.privateKey;
                if (!merchantPrivateKey) {
                    throw new Error('微信 JSAPI 支付失败：商户私钥(privateKey)未配置，请检查支付方式配置');
                }
                const privateKeyBuf = Buffer.from(merchantPrivateKey);
                const signContent = `${jsapiAppId}\n${jsapiTimeStamp}\n${jsapiNonceStr}\n${jsapiPackage}\n`;
                const paySign = crypto_1.default
                    .sign('RSA-SHA256', Buffer.from(signContent), { key: privateKeyBuf })
                    .toString('base64');
                return {
                    amount,
                    state: 'Authorized',
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
                // 退款使用多租户凭证 override，与 createPayment 保持一致
                const override = (0, payment_config_1.getPaymentOverride)(ctx, 'wechatpay');
                const pay = new wechatpay_node_v3_1.default({
                    appid: (override === null || override === void 0 ? void 0 : override.appId) || args.appId,
                    mchid: (override === null || override === void 0 ? void 0 : override.mchId) || args.mchId,
                    publicKey: Buffer.from((override === null || override === void 0 ? void 0 : override.publicKey) || args.publicKey),
                    privateKey: Buffer.from((override === null || override === void 0 ? void 0 : override.privateKey) || args.privateKey),
                    key: (override === null || override === void 0 ? void 0 : override.apiKey) || args.apiKey,
                    serial_no: (override === null || override === void 0 ? void 0 : override.serialNo) || args.serialNo,
                });
                const result = await pay.refunds({
                    out_trade_no: order.code,
                    out_refund_no: `REFUND-${payment.id}-${Date.now()}`,
                    amount: {
                        // 单位同 createPayment：Vendure 的退款额/原支付额均以「分」计，
                        // 微信 V3 退款 amount.refund/total 亦为「分」，切勿 /100。
                        refund: Math.round(amount),
                        total: Math.round(payment.amount),
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