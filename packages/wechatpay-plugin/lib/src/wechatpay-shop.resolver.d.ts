import { RequestContext } from '@vendure/core';
import { WechatpayService, BarePaymentInput } from './wechatpay.service';
export declare class WechatpayShopResolver {
    private wechatpayService;
    constructor(wechatpayService: WechatpayService);
    wechatpayCreatePayment(ctx: RequestContext, input: BarePaymentInput): Promise<unknown>;
}
