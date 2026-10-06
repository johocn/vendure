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
var WechatpayPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WechatpayPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const wechatpay_handler_1 = require("./wechatpay-handler");
const wechatpay_service_1 = require("./wechatpay.service");
const wechatpay_settlement_1 = require("./wechatpay-settlement");
const wechatpay_shop_resolver_1 = require("./wechatpay-shop.resolver");
const wechatpay_controller_1 = require("./wechatpay.controller");
const { gql } = require('graphql-tag');
let WechatpayPlugin = WechatpayPlugin_1 = class WechatpayPlugin {
    constructor(options, paymentMethodService, channelService, requestContextService, wechatpayService) {
        this.options = options;
        this.paymentMethodService = paymentMethodService;
        this.channelService = channelService;
        this.requestContextService = requestContextService;
        this.wechatpayService = wechatpayService;
    }
    static init(options) {
        WechatpayPlugin_1.options = options;
        return WechatpayPlugin_1;
    }
    /**
     * Dev Bypass 模式下，启动时自动创建 wechatpay PaymentMethod（如果不存在）
     */
    async onApplicationBootstrap() {
        var _a;
        // 注册进程内服务引用（F-VS-08）：供支付 handler / 充值插件在无 DI 上下文处推导 openid。
        // 必须放在 devBypass 早退之前，保证任何运行模式下都可用。
        (0, wechatpay_service_1.setWechatpayServiceRef)(this.wechatpayService);
        if (!((_a = this.options) === null || _a === void 0 ? void 0 : _a.devBypass))
            return;
        try {
            const channel = await this.channelService.getDefaultChannel();
            const ctx = new core_1.RequestContext({
                apiType: 'admin',
                channel,
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
            });
            const existing = await this.paymentMethodService.findAll(ctx);
            const hasWechatpay = existing.items.some(p => p.code === 'wechatpay');
            if (!hasWechatpay) {
                await this.paymentMethodService.create(ctx, {
                    code: 'wechatpay',
                    enabled: true,
                    handler: { code: 'wechatpay', arguments: [] },
                    translations: [
                        { languageCode: core_1.LanguageCode.zh_Hans, name: '微信支付' },
                        { languageCode: core_1.LanguageCode.en, name: 'WeChat Pay' },
                    ],
                });
                core_1.Logger.info('[WechatpayPlugin] Created wechatpay PaymentMethod (devBypass)', constants_1.loggerCtx);
            }
        }
        catch (e) {
            core_1.Logger.error(`[WechatpayPlugin] Failed to auto-create PaymentMethod: ${e.message}`, constants_1.loggerCtx);
        }
    }
};
exports.WechatpayPlugin = WechatpayPlugin;
exports.WechatpayPlugin = WechatpayPlugin = WechatpayPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        controllers: [wechatpay_controller_1.WechatpayController],
        providers: [
            { provide: constants_1.WECHATPAY_PLUGIN_OPTIONS, useFactory: () => WechatpayPlugin.options },
            wechatpay_service_1.WechatpayService,
            wechatpay_settlement_1.WechatpaySettlementRegistry,
        ],
        shopApiExtensions: {
            schema: () => gql `
            type WechatpayCreatePaymentResult {
                payType: String!
                prepayId: String
                appId: String
                timeStamp: String
                nonceStr: String
                package: String
                signType: String
                paySign: String
                payUrl: String
            }
            input WechatpayPaymentInput {
                outTradeNo: String!
                amount: Int!
                tradeType: String
                openid: String
                description: String
            }
            extend type Mutation {
                wechatpayCreatePayment(input: WechatpayPaymentInput!): WechatpayCreatePaymentResult!
            }
        `,
            resolvers: [wechatpay_shop_resolver_1.WechatpayShopResolver],
        },
        configuration: config => {
            var _a;
            // 主方法 + 可配置的额外方法 code（分端分支付方案，handler 逻辑相同仅 code 不同）
            const codes = ['wechatpay', ...(((_a = WechatpayPlugin.options) === null || _a === void 0 ? void 0 : _a.extraHandlerCodes) || [])];
            const handlers = codes.map(code => (0, wechatpay_handler_1.createWechatpayHandler)(WechatpayPlugin.options, code));
            config.paymentOptions.paymentMethodHandlers = [
                ...(config.paymentOptions.paymentMethodHandlers || []),
                ...handlers,
            ];
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.WECHATPAY_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.PaymentMethodService,
        core_1.ChannelService,
        core_1.RequestContextService,
        wechatpay_service_1.WechatpayService])
], WechatpayPlugin);
//# sourceMappingURL=plugin.js.map