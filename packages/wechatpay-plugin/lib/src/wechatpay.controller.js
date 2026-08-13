"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WechatpayController = void 0;
const common_1 = require("@nestjs/common");
const wechatpay_node_v3_1 = __importDefault(require("wechatpay-node-v3"));
const core_1 = require("@vendure/core");
const cjk_plugin_1 = require("@vendure/cjk-plugin");
const constants_1 = require("./constants");
let WechatpayController = class WechatpayController {
    constructor(options, orderService, channelService, paymentMethodService, requestContextService) {
        this.options = options;
        this.orderService = orderService;
        this.channelService = channelService;
        this.paymentMethodService = paymentMethodService;
        this.requestContextService = requestContextService;
    }
    /**
     * 结算订单支付：dev-notify 和 notify 共用
     * 查询 Authorized 状态的支付并调用 settlePayment
     * 注意：订单到达 PaymentAuthorized 后 active=false，不能用 order.active 判断
     */
    async settleOrderPayment(orderCode) {
        const channel = await this.channelService.getDefaultChannel();
        const ctx = new core_1.RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
        const order = await this.orderService.findOneByCode(ctx, orderCode, ['payments']);
        if (!order) {
            core_1.Logger.warn(`settleOrderPayment: order ${orderCode} not found`, constants_1.loggerCtx);
            return;
        }
        const payments = order.payments || [];
        for (const payment of payments) {
            if (payment.state === 'Authorized') {
                try {
                    await this.orderService.settlePayment(ctx, payment.id);
                    core_1.Logger.info(`Settled payment ${payment.id} for order ${orderCode}`, constants_1.loggerCtx);
                }
                catch (e) {
                    core_1.Logger.error(`settlePayment failed for payment ${payment.id}: ${e.message}`, constants_1.loggerCtx);
                }
            }
        }
    }
    /**
     * 从默认 channel 的 PaymentMethod args + channel override 构造 WxPay 实例
     * 用于通知回调中验签解密
     */
    async buildWxPayFromDefaultChannel() {
        var _a;
        const channel = await this.channelService.getDefaultChannel();
        const ctx = new core_1.RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
        const override = (0, cjk_plugin_1.getPaymentOverride)(ctx, 'wechatpay');
        const pms = await this.paymentMethodService.findAll(ctx);
        const pm = pms.items.find(p => p.code === 'wechatpay');
        const args = ((_a = pm === null || pm === void 0 ? void 0 : pm.handler) === null || _a === void 0 ? void 0 : _a.args) || [];
        const getArg = (name) => { var _a; return ((_a = args.find(a => a.name === name)) === null || _a === void 0 ? void 0 : _a.value) || ''; };
        const apiKey = (override === null || override === void 0 ? void 0 : override.apiKey) || getArg('apiKey');
        const pay = new wechatpay_node_v3_1.default({
            appid: (override === null || override === void 0 ? void 0 : override.appId) || getArg('appId'),
            mchid: (override === null || override === void 0 ? void 0 : override.mchId) || getArg('mchId'),
            publicKey: Buffer.from((override === null || override === void 0 ? void 0 : override.publicKey) || getArg('publicKey')),
            privateKey: Buffer.from((override === null || override === void 0 ? void 0 : override.privateKey) || getArg('privateKey')),
            key: apiKey,
            serial_no: (override === null || override === void 0 ? void 0 : override.serialNo) || getArg('serialNo'),
        });
        return { pay, apiKey };
    }
    /**
     * 生产环境：V3 通知验签 + AES-GCM 解密
     */
    async notify(req, res, body) {
        try {
            const { 'wechatpay-timestamp': timestamp, 'wechatpay-nonce': nonce, 'wechatpay-signature': signature, 'wechatpay-serial': serial, } = req.headers;
            const resource = body === null || body === void 0 ? void 0 : body.resource;
            if (!resource) {
                return res.status(400).json({ code: 'FAIL', message: 'missing resource' });
            }
            const { pay, apiKey } = await this.buildWxPayFromDefaultChannel();
            // 1. 验签
            const bodyStr = JSON.stringify(body);
            const verified = pay.verifySign({
                timestamp,
                nonce,
                body: bodyStr,
                serial,
                signature,
                apiSecret: apiKey,
            });
            if (!verified) {
                core_1.Logger.warn('WeChat Pay notify signature verification failed', constants_1.loggerCtx);
                return res.status(401).json({ code: 'FAIL', message: '签名验证失败' });
            }
            // 2. AES-GCM 解密
            const decrypted = pay.decipher_gcm(resource.ciphertext, resource.associated_data, resource.nonce);
            const outTradeNo = decrypted === null || decrypted === void 0 ? void 0 : decrypted.out_trade_no;
            const transactionId = decrypted === null || decrypted === void 0 ? void 0 : decrypted.transaction_id;
            core_1.Logger.info(`WeChat Pay trade success: ${outTradeNo}, txId: ${transactionId}`, constants_1.loggerCtx);
            // 3. 处理支付结果
            if ((body === null || body === void 0 ? void 0 : body.event_type) === 'TRANSACTION.SUCCESS' && outTradeNo) {
                await this.settleOrderPayment(outTradeNo);
            }
            res.status(200).json({ code: 'SUCCESS', message: 'OK' });
        }
        catch (e) {
            core_1.Logger.error(`WeChat Pay notify error: ${e.message}`, constants_1.loggerCtx);
            res.status(500).json({ code: 'FAIL', message: e.message });
        }
    }
    /**
     * Dev Bypass: 模拟微信支付页面
     */
    getDevPayPage(req, res) {
        const orderCode = req.query.orderCode;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>模拟微信支付</title>
</head>
<body style="font-family:sans-serif;text-align:center;padding:40px;">
    <h2>模拟微信支付</h2>
    <p>订单号: ${orderCode}</p>
    <button onclick="pay()" style="padding:12px 40px;font-size:16px;background:#07c160;color:#fff;border:none;border-radius:4px;cursor:pointer;">
        模拟支付成功
    </button>
    <p id="msg" style="margin-top:20px;color:#666;"></p>
    <script>
        async function pay() {
            document.getElementById('msg').innerText = '正在处理...';
            try {
                const res = await fetch('/wechatpay/dev-notify?orderCode=${orderCode}', {
                    method: 'POST'
                });
                const data = await res.json();
                if (data.code === 'SUCCESS') {
                    document.body.innerHTML =
                        '<h2 style="color:#07c160">支付成功</h2>' +
                        '<p>订单: ${orderCode}</p>' +
                        '<a href="/" style="color:#576b95;">返回商城</a>';
                } else {
                    document.getElementById('msg').innerText = '支付失败: ' + (data.message || '未知错误');
                }
            } catch (e) {
                document.getElementById('msg').innerText = '请求失败: ' + e.message;
            }
        }
    </script>
</body>
</html>`);
    }
    /**
     * Dev Bypass: 自动回调，结算订单
     */
    async devNotify(req, res) {
        const orderCode = req.query.orderCode;
        try {
            if (!orderCode) {
                return res.status(400).json({ code: 'FAIL', message: 'missing orderCode' });
            }
            await this.settleOrderPayment(orderCode);
            res.status(200).json({ code: 'SUCCESS', message: 'OK' });
        }
        catch (e) {
            core_1.Logger.error(`WeChat Pay dev-notify error: ${e.message}`, constants_1.loggerCtx);
            res.status(500).json({ code: 'FAIL', message: e.message });
        }
    }
};
exports.WechatpayController = WechatpayController;
__decorate([
    (0, common_1.Post)('notify'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], WechatpayController.prototype, "notify", null);
__decorate([
    (0, common_1.Get)('dev-pay'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], WechatpayController.prototype, "getDevPayPage", null);
__decorate([
    (0, common_1.Post)('dev-notify'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], WechatpayController.prototype, "devNotify", null);
exports.WechatpayController = WechatpayController = __decorate([
    (0, common_1.Controller)('wechatpay'),
    __param(0, (0, common_1.Inject)(constants_1.WECHATPAY_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.OrderService,
        core_1.ChannelService,
        core_1.PaymentMethodService,
        core_1.RequestContextService])
], WechatpayController);
//# sourceMappingURL=wechatpay.controller.js.map