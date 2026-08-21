import { ChannelService, PaymentMethodService } from '@vendure/core';
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
export declare class WechatpayService {
    private options;
    private channelService;
    private paymentMethodService;
    constructor(options: WechatpayPluginOptions, channelService: ChannelService, paymentMethodService: PaymentMethodService);
    /** 集中构造配置好的 WxPay 实例 + 凭证（复用 getPaymentOverride） */
    private buildWechatpay;
    /** devBypass 下返回模拟支付页；否则调真实微信 API 生成支付参数 */
    createBarePayment(input: BarePaymentInput): Promise<BarePaymentResult>;
}
