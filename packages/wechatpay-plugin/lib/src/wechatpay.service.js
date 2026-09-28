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
exports.WechatpayService = void 0;
exports.setWechatpayServiceRef = setWechatpayServiceRef;
exports.resolveCustomerOpenid = resolveCustomerOpenid;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const crypto_1 = __importDefault(require("crypto"));
const wechatpay_node_v3_1 = __importDefault(require("wechatpay-node-v3"));
const cjk_plugin_1 = require("@vendure/cjk-plugin");
const constants_1 = require("./constants");
/**
 * 进程内 WechatpayService 引用（沿用本项目 `setWechatpayGateway` / `getPaymentOverride`
 * 的注册模式），供支付 handler 与其它插件在无 DI 上下文处推导 openid。
 * 未注册（未装载 WechatpayPlugin）时为 null，推导一律返回 undefined。
 */
let wechatpayServiceRef = null;
function setWechatpayServiceRef(service) {
    wechatpayServiceRef = service;
}
/** 由客户档案推导 openid 的模块级入口（失败不阻断支付，仅记日志后返回 undefined） */
async function resolveCustomerOpenid(ctx, customerId, opts) {
    if (!wechatpayServiceRef)
        return undefined;
    try {
        return await wechatpayServiceRef.resolveCustomerOpenid(ctx, customerId, opts);
    }
    catch (e) {
        core_1.Logger.warn(`resolveCustomerOpenid failed: ${e.message}`, constants_1.loggerCtx);
        return undefined;
    }
}
let WechatpayService = class WechatpayService {
    constructor(options, channelService, paymentMethodService, connection, customerService) {
        this.options = options;
        this.channelService = channelService;
        this.paymentMethodService = paymentMethodService;
        this.connection = connection;
        this.customerService = customerService;
    }
    /**
     * 由客户档案推导微信 openid（F-VS-08）。
     * openid 由微信授权登录时写入 `Customer.customFields.wechatOpenid` / `wechatMiniOpenid`，
     * 支付时无需（也不应）依赖前端本地存储。
     * 仅存其一则用之；两者都有时按 `preferMini` 取舍（默认优先公众号 openid）。
     */
    async resolveCustomerOpenid(ctx, customerId, opts) {
        var _a;
        let id = customerId;
        if ((id === undefined || id === null) && ctx.activeUserId) {
            const byUser = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            id = byUser === null || byUser === void 0 ? void 0 : byUser.id;
        }
        if (id === undefined || id === null)
            return undefined;
        const customer = await this.connection.getRepository(ctx, core_1.Customer).findOne({
            where: { id: id },
        });
        const cf = ((_a = customer === null || customer === void 0 ? void 0 : customer.customFields) !== null && _a !== void 0 ? _a : {});
        const official = cf.wechatOpenid || undefined;
        const mini = cf.wechatMiniOpenid || undefined;
        if (official && mini)
            return (opts === null || opts === void 0 ? void 0 : opts.preferMini) ? mini : official;
        return mini || official;
    }
    /** 集中构造配置好的 WxPay 实例 + 凭证（复用 getPaymentOverride） */
    async buildWechatpay() {
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
        const appId = (override === null || override === void 0 ? void 0 : override.appId) || getArg('appId');
        const privateKey = (override === null || override === void 0 ? void 0 : override.privateKey) || getArg('privateKey');
        return {
            pay: new wechatpay_node_v3_1.default({
                appid: appId,
                mchid: (override === null || override === void 0 ? void 0 : override.mchId) || getArg('mchId'),
                publicKey: Buffer.from((override === null || override === void 0 ? void 0 : override.publicKey) || getArg('publicKey')),
                privateKey: Buffer.from(privateKey),
                key: (override === null || override === void 0 ? void 0 : override.apiKey) || getArg('apiKey'),
                serial_no: (override === null || override === void 0 ? void 0 : override.serialNo) || getArg('serialNo'),
            }),
            appId,
            privateKey,
            tradeType: (override === null || override === void 0 ? void 0 : override.tradeType) || getArg('tradeType') || 'JSAPI',
        };
    }
    /** devBypass 下返回模拟支付页；否则调真实微信 API 生成支付参数 */
    async createBarePayment(input) {
        var _a, _b, _c, _d, _e, _f;
        if ((_a = this.options) === null || _a === void 0 ? void 0 : _a.devBypass) {
            return {
                payType: 'dev-h5',
                payUrl: `/wechatpay/dev-pay?outTradeNo=${encodeURIComponent(input.outTradeNo)}`,
            };
        }
        const { pay, appId, privateKey, tradeType } = await this.buildWechatpay();
        const baseParams = {
            description: input.description || `Pay ${input.outTradeNo}`,
            out_trade_no: input.outTradeNo,
            notify_url: ((_b = this.options) === null || _b === void 0 ? void 0 : _b.notifyUrl) || '',
            amount: { total: Math.round(input.amount / 100), currency: 'CNY' },
        };
        const type = input.tradeType || tradeType;
        if (type === 'NATIVE') {
            const r = (await pay.transactions_native(baseParams));
            return { payType: 'native', payUrl: (_c = r === null || r === void 0 ? void 0 : r.data) === null || _c === void 0 ? void 0 : _c.code_url };
        }
        if (type === 'H5') {
            const r = (await pay.transactions_h5(Object.assign(Object.assign({}, baseParams), { scene_info: {
                    payer_client_ip: '127.0.0.1',
                    h5_info: { type: 'Wap', app_name: 'Vendure' },
                } })));
            return { payType: 'h5', payUrl: (_d = r === null || r === void 0 ? void 0 : r.data) === null || _d === void 0 ? void 0 : _d.h5_url };
        }
        if (type === 'APP') {
            const r = (await pay.transactions_app(baseParams));
            return { payType: 'app', prepayId: (_e = r === null || r === void 0 ? void 0 : r.data) === null || _e === void 0 ? void 0 : _e.prepay_id };
        }
        // JSAPI
        const r = (await pay.transactions_jsapi(Object.assign(Object.assign({}, baseParams), { payer: { openid: input.openid || '' } })));
        const prepayId = (_f = r === null || r === void 0 ? void 0 : r.data) === null || _f === void 0 ? void 0 : _f.prepay_id;
        const timeStamp = String(Math.floor(Date.now() / 1000));
        const nonceStr = Math.random().toString(36).substring(2, 34);
        const pkg = `prepay_id=${prepayId}`;
        const paySign = crypto_1.default
            .sign('RSA-SHA256', Buffer.from(`${appId}\n${timeStamp}\n${nonceStr}\n${pkg}\n`), {
            key: Buffer.from(privateKey),
        })
            .toString('base64');
        return { payType: 'jsapi', prepayId, appId, timeStamp, nonceStr, package: pkg, signType: 'RSA', paySign };
    }
};
exports.WechatpayService = WechatpayService;
exports.WechatpayService = WechatpayService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.WECHATPAY_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.ChannelService,
        core_1.PaymentMethodService,
        core_1.TransactionalConnection,
        core_1.CustomerService])
], WechatpayService);
//# sourceMappingURL=wechatpay.service.js.map