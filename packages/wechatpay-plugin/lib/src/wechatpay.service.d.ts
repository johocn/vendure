import { ChannelService, CustomerService, ID, PaymentMethodService, RequestContext, TransactionalConnection } from '@vendure/core';
import { WechatpayPluginOptions } from './types';
export interface BarePaymentInput {
    outTradeNo: string;
    /** 金额：分 */
    amount: number;
    tradeType?: 'JSAPI' | 'NATIVE' | 'H5' | 'APP';
    openid?: string;
    description?: string;
    /** 指定支付方法 code（分端分支付方案：充值/代付按端选方法，如 'wechatpay' / 'wechatpay-youshop-jsapi'）。
     *  显式指定时优先用该方法的 args，不再叠加渠道 override。 */
    methodCode?: string;
}
export interface BareRefundInput {
    outTradeNo: string;
    outRefundNo: string;
    /** 退款金额：分 */
    refund: number;
    /** 原订单金额：分 */
    total: number;
    reason?: string;
    /** 指定支付方法 code（同 BarePaymentInput.methodCode 口径） */
    methodCode?: string;
}
export interface BareRefundResult {
    refundId?: string;
    outRefundNo?: string;
    /** 微信退款状态：SUCCESS/CLOSED/PROCESSING/ABNORMAL 等 */
    status?: string;
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
export declare function setWechatpayServiceRef(service: WechatpayService | null): void;
/** 由客户档案推导 openid 的模块级入口（失败不阻断支付，仅记日志后返回 undefined） */
export declare function resolveCustomerOpenid(ctx: RequestContext, customerId?: ID | null, opts?: {
    preferMini?: boolean;
}): Promise<string | undefined>;
export declare class WechatpayService {
    private options;
    private channelService;
    private paymentMethodService;
    private connection;
    private customerService;
    constructor(options: WechatpayPluginOptions, channelService: ChannelService, paymentMethodService: PaymentMethodService, connection: TransactionalConnection, customerService: CustomerService);
    /**
     * 由客户档案推导微信 openid（F-VS-08）。
     * openid 由微信授权登录时写入 `Customer.customFields.wechatOpenid` / `wechatMiniOpenid`，
     * 支付时无需（也不应）依赖前端本地存储。
     * 仅存其一则用之；两者都有时按 `preferMini` 取舍（默认优先公众号 openid）。
     */
    resolveCustomerOpenid(ctx: RequestContext, customerId?: ID | null, opts?: {
        preferMini?: boolean;
    }): Promise<string | undefined>;
    /** 默认渠道 ctx（未按租户指定渠道时的回退，兼容历史单店部署） */
    private defaultChannelCtx;
    /** 微信错误体优先取 {code,message}（errRaw.response.text / error），避免长 JSON 截断后丢失错误码 */
    private wxErrorText;
    /** 集中构造配置好的 WxPay 实例 + 凭证（复用 getPaymentOverride）。
     *  传入 ctx 时使用「该 ctx 所属租户」的凭证与回调地址；缺省回退默认渠道。
     *  显式传 methodCode（分端分支付方案）时直接用该方法的 args，不再叠加渠道 override。 */
    private buildWechatpay;
    /**
     * 按 code 找支付方法：显式 code 只做精确匹配；隐式 'wechatpay' 时依次回退
     * 「渠道内任一微信支付处理器方法（wechatpay-xxx）」→「默认渠道同名方法」。
     * 分租户只配了渠道 override、或只配了 wechatpay-xxx 方法时都不会再取到空参数。
     */
    private findPaymentMethod;
    /** 渠道是否配置了微信支付商户凭证（payConfig.wechatpayJson）。
     *  有 override = 该租户自带商户参数（公众号/H5 场景），JSAPI 应取公众号 openid；
     *  无 override 回退平台默认支付方式（小程序 appid），沿用小程序 openid 优先。 */
    hasChannelPayConfig(ctx: RequestContext): boolean;
    /** devBypass 下返回模拟支付页；否则调真实微信 API 生成支付参数。
     *  ctx 决定用哪个租户的商户凭证与回调地址（CS-/RC- 等代付单须传自身 ctx）。 */
    createBarePayment(input: BarePaymentInput, ctx?: RequestContext): Promise<BarePaymentResult>;
    /** 裸退款（POST /v3/refund/domestic/refunds）：ctx 决定用哪个租户的商户凭证（同 createBarePayment）。
     *  微信侧错误（非 2xx 或无 refund_id）显式抛出，供调用方落 failed 走重试。 */
    refundBarePayment(ctx: RequestContext | undefined, input: BareRefundInput): Promise<BareRefundResult>;
    /** 查询单笔退款（GET /v3/refund/domestic/refunds/{out_refund_no}），供卡单对账；查无记录返回 null。 */
    findBareRefund(ctx: RequestContext | undefined, outRefundNo: string, methodCode?: string): Promise<BareRefundResult | null>;
}
