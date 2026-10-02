import { Inject, Injectable } from '@nestjs/common';
import {
    ChannelService,
    Customer,
    CustomerService,
    ID,
    Logger,
    PaymentMethodService,
    RequestContext,
    TransactionalConnection,
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

/**
 * 进程内 WechatpayService 引用（沿用本项目 `setWechatpayGateway` / `getPaymentOverride`
 * 的注册模式），供支付 handler 与其它插件在无 DI 上下文处推导 openid。
 * 未注册（未装载 WechatpayPlugin）时为 null，推导一律返回 undefined。
 */
let wechatpayServiceRef: WechatpayService | null = null;

export function setWechatpayServiceRef(service: WechatpayService | null): void {
    wechatpayServiceRef = service;
}

/** 由客户档案推导 openid 的模块级入口（失败不阻断支付，仅记日志后返回 undefined） */
export async function resolveCustomerOpenid(
    ctx: RequestContext,
    customerId?: ID | null,
    opts?: { preferMini?: boolean },
): Promise<string | undefined> {
    if (!wechatpayServiceRef) return undefined;
    try {
        return await wechatpayServiceRef.resolveCustomerOpenid(ctx, customerId, opts);
    } catch (e: any) {
        Logger.warn(`resolveCustomerOpenid failed: ${e.message}`, loggerCtx);
        return undefined;
    }
}

@Injectable()
export class WechatpayService {
    constructor(
        @Inject(WECHATPAY_PLUGIN_OPTIONS) private options: WechatpayPluginOptions,
        private channelService: ChannelService,
        private paymentMethodService: PaymentMethodService,
        private connection: TransactionalConnection,
        private customerService: CustomerService,
    ) {}

    /**
     * 由客户档案推导微信 openid（F-VS-08）。
     * openid 由微信授权登录时写入 `Customer.customFields.wechatOpenid` / `wechatMiniOpenid`，
     * 支付时无需（也不应）依赖前端本地存储。
     * 仅存其一则用之；两者都有时按 `preferMini` 取舍（默认优先公众号 openid）。
     */
    async resolveCustomerOpenid(
        ctx: RequestContext,
        customerId?: ID | null,
        opts?: { preferMini?: boolean },
    ): Promise<string | undefined> {
        let id = customerId;
        if ((id === undefined || id === null) && ctx.activeUserId) {
            const byUser = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
            id = byUser?.id;
        }
        if (id === undefined || id === null) return undefined;
        const customer = await this.connection.getRepository(ctx, Customer).findOne({
            where: { id: id as any },
        });
        const cf = (customer?.customFields ?? {}) as any;
        const official: string | undefined = cf.wechatOpenid || undefined;
        const mini: string | undefined = cf.wechatMiniOpenid || undefined;
        if (official && mini) return opts?.preferMini ? mini : official;
        return mini || official;
    }

    /** 默认渠道 ctx（未按租户指定渠道时的回退，兼容历史单店部署） */
    private async defaultChannelCtx(): Promise<RequestContext> {
        const channel = await this.channelService.getDefaultChannel();
        return new RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
    }

    /** 集中构造配置好的 WxPay 实例 + 凭证（复用 getPaymentOverride）。
     *  传入 ctx 时使用「该 ctx 所属租户」的凭证与回调地址；缺省回退默认渠道。 */
    private async buildWechatpay(ctx?: RequestContext): Promise<{
        pay: WxPay;
        appId: string;
        privateKey: string;
        tradeType: string;
        notifyUrl: string;
    }> {
        const effectiveCtx = ctx ?? (await this.defaultChannelCtx());
        const override = getPaymentOverride(effectiveCtx, 'wechatpay') as WechatpayCredentials | null;
        const pms = await this.paymentMethodService.findAll(effectiveCtx);
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
            notifyUrl: override?.notifyUrl || this.options?.notifyUrl || '',
        };
    }

    /** devBypass 下返回模拟支付页；否则调真实微信 API 生成支付参数。
     *  ctx 决定用哪个租户的商户凭证与回调地址（CS-/RC- 等代付单须传自身 ctx）。 */
    async createBarePayment(input: BarePaymentInput, ctx?: RequestContext): Promise<BarePaymentResult> {
        if (this.options?.devBypass) {
            return {
                payType: 'dev-h5',
                payUrl: `/wechatpay/dev-pay?outTradeNo=${encodeURIComponent(input.outTradeNo)}`,
            };
        }
        const { pay, appId, privateKey, tradeType, notifyUrl } = await this.buildWechatpay(ctx);
        const baseParams = {
            description: input.description || `Pay ${input.outTradeNo}`,
            out_trade_no: input.outTradeNo,
            notify_url: notifyUrl,
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