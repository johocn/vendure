import { Inject, Injectable } from '@nestjs/common';
import {
    ChannelService,
    Logger,
    PaymentMethodService,
    RequestContext,
} from '@vendure/core';
import crypto from 'crypto';
import WxPay from 'wechatpay-node-v3';
import { getPaymentOverride } from '@vendure/cjk-plugin';
import type { WechatpayCredentials } from '@vendure/cjk-plugin';

import { WECHATPAY_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { WechatpayPluginOptions } from './types';

export interface BarePaymentInput {
    outTradeNo: string;
    /** 金额：分 */
    amount: number;
    tradeType?: 'JSAPI' | 'NATIVE' | 'H5' | 'APP';
    openid?: string;
    description?: string;
}

export interface BarePaymentResult {
    payType: string;
    prepayId?: string;
    appId?: string;
    timeStamp?: string;
    nonceStr?: string;
    package?: string;
    signType?: string;
    paySign?: string;
    payUrl?: string;
}

@Injectable()
export class WechatpayService {
    constructor(
        @Inject(WECHATPAY_PLUGIN_OPTIONS) private options: WechatpayPluginOptions,
        private channelService: ChannelService,
        private paymentMethodService: PaymentMethodService,
    ) {}

    /** 集中构造配置好的 WxPay 实例 + 凭证（复用 getPaymentOverride） */
    private async buildWechatpay(): Promise<{
        pay: WxPay;
        appId: string;
        privateKey: string;
        tradeType: string;
    }> {
        const channel = await this.channelService.getDefaultChannel();
        const ctx = new RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
        const override = getPaymentOverride(ctx, 'wechatpay') as WechatpayCredentials | null;
        const pms = await this.paymentMethodService.findAll(ctx);
        const pm = pms.items.find(p => p.code === 'wechatpay');
        const args = pm?.handler?.args || [];
        const getArg = (name: string) => args.find(a => a.name === name)?.value || '';
        const appId = override?.appId || getArg('appId');
        const privateKey = override?.privateKey || getArg('privateKey');
        return {
            pay: new WxPay({
                appid: appId,
                mchid: override?.mchId || getArg('mchId'),
                publicKey: Buffer.from(override?.publicKey || getArg('publicKey')),
                privateKey: Buffer.from(privateKey),
                key: override?.apiKey || getArg('apiKey'),
                serial_no: override?.serialNo || getArg('serialNo'),
            }),
            appId,
            privateKey,
            tradeType: override?.tradeType || getArg('tradeType') || 'JSAPI',
        };
    }

    /** devBypass 下返回模拟支付页；否则调真实微信 API 生成支付参数 */
    async createBarePayment(input: BarePaymentInput): Promise<BarePaymentResult> {
        if (this.options?.devBypass) {
            return {
                payType: 'dev-h5',
                payUrl: `/wechatpay/dev-pay?outTradeNo=${encodeURIComponent(input.outTradeNo)}`,
            };
        }
        const { pay, appId, privateKey, tradeType } = await this.buildWechatpay();
        const baseParams = {
            description: input.description || `Pay ${input.outTradeNo}`,
            out_trade_no: input.outTradeNo,
            notify_url: this.options?.notifyUrl || '',
            amount: { total: Math.round(input.amount / 100), currency: 'CNY' },
        };
        const type = input.tradeType || tradeType;

        if (type === 'NATIVE') {
            const r = (await pay.transactions_native(baseParams)) as any;
            return { payType: 'native', payUrl: r?.data?.code_url };
        }
        if (type === 'H5') {
            const r = (await pay.transactions_h5({
                ...baseParams,
                scene_info: {
                    payer_client_ip: '127.0.0.1',
                    h5_info: { type: 'Wap', app_name: 'Vendure' },
                },
            })) as any;
            return { payType: 'h5', payUrl: r?.data?.h5_url };
        }
        if (type === 'APP') {
            const r = (await pay.transactions_app(baseParams)) as any;
            return { payType: 'app', prepayId: r?.data?.prepay_id };
        }
        // JSAPI
        const r = (await pay.transactions_jsapi({
            ...baseParams,
            payer: { openid: input.openid || '' },
        })) as any;
        const prepayId = r?.data?.prepay_id;
        const timeStamp = String(Math.floor(Date.now() / 1000));
        const nonceStr = Math.random().toString(36).substring(2, 34);
        const pkg = `prepay_id=${prepayId}`;
        const paySign = crypto
            .sign('RSA-SHA256', Buffer.from(`${appId}\n${timeStamp}\n${nonceStr}\n${pkg}\n`), {
                key: Buffer.from(privateKey),
            })
            .toString('base64');
        return { payType: 'jsapi', prepayId, appId, timeStamp, nonceStr, package: pkg, signType: 'RSA', paySign };
    }
}