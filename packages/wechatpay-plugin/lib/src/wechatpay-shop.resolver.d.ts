import { WechatpayService, BarePaymentInput } from './wechatpay.service';
export declare class WechatpayShopResolver {
    private wechatpayService;
    constructor(wechatpayService: WechatpayService);
    wechatpayCreatePayment(input: BarePaymentInput): Promise<unknown>;
}
