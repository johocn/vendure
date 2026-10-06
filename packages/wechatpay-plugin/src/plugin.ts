import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import {
    LanguageCode,
    Logger,
    PaymentMethodService,
    ChannelService,
    PluginCommonModule,
    RequestContext,
    RequestContextService,
    VendurePlugin,
} from '@vendure/core';

import { WECHATPAY_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { createWechatpayHandler } from './wechatpay-handler';
import { setWechatpayServiceRef, WechatpayService } from './wechatpay.service';
import { WechatpaySettlementRegistry } from './wechatpay-settlement';
import { WechatpayShopResolver } from './wechatpay-shop.resolver';
import { WechatpayController } from './wechatpay.controller';
import { WechatpayPluginOptions } from './types';

const { gql } = require('graphql-tag');

@VendurePlugin({
    imports: [PluginCommonModule],
    controllers: [WechatpayController],
    providers: [
        { provide: WECHATPAY_PLUGIN_OPTIONS, useFactory: () => WechatpayPlugin.options },
        WechatpayService,
        WechatpaySettlementRegistry,
    ],
    shopApiExtensions: {
        schema: () => gql`
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
        resolvers: [WechatpayShopResolver],
    },
    configuration: config => {
        // 主方法 + 可配置的额外方法 code（分端分支付方案，handler 逻辑相同仅 code 不同）
        const codes = ['wechatpay', ...(WechatpayPlugin.options?.extraHandlerCodes || [])];
        const handlers = codes.map(code => createWechatpayHandler(WechatpayPlugin.options, code));
        config.paymentOptions.paymentMethodHandlers = [
            ...(config.paymentOptions.paymentMethodHandlers || []),
            ...handlers,
        ];
        return config;
    },
    compatibility: '^3.0.0',
})
export class WechatpayPlugin implements OnApplicationBootstrap {
    private static options: WechatpayPluginOptions;

    constructor(
        @Inject(WECHATPAY_PLUGIN_OPTIONS) private options: WechatpayPluginOptions,
        private paymentMethodService: PaymentMethodService,
        private channelService: ChannelService,
        private requestContextService: RequestContextService,
        private wechatpayService: WechatpayService,
    ) {}

    static init(options: WechatpayPluginOptions): Type<WechatpayPlugin> {
        WechatpayPlugin.options = options;
        return WechatpayPlugin;
    }

    /**
     * Dev Bypass 模式下，启动时自动创建 wechatpay PaymentMethod（如果不存在）
     */
    async onApplicationBootstrap() {
        // 注册进程内服务引用（F-VS-08）：供支付 handler / 充值插件在无 DI 上下文处推导 openid。
        // 必须放在 devBypass 早退之前，保证任何运行模式下都可用。
        setWechatpayServiceRef(this.wechatpayService);
        if (!this.options?.devBypass) return;
        try {
            const channel = await this.channelService.getDefaultChannel();
            const ctx = new RequestContext({
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
                        { languageCode: LanguageCode.zh_Hans, name: '微信支付' },
                        { languageCode: LanguageCode.en, name: 'WeChat Pay' },
                    ],
                });
                Logger.info(
                    '[WechatpayPlugin] Created wechatpay PaymentMethod (devBypass)',
                    loggerCtx,
                );
            }
        } catch (e: any) {
            Logger.error(
                `[WechatpayPlugin] Failed to auto-create PaymentMethod: ${e.message}`,
                loggerCtx,
            );
        }
    }
}
