import { Request, Response } from 'express';
import { OrderService, ChannelService, PaymentMethodService, RequestContextService } from '@vendure/core';
import { WechatpayPluginOptions } from './types';
export declare class WechatpayController {
    private options;
    private orderService;
    private channelService;
    private paymentMethodService;
    private requestContextService;
    constructor(options: WechatpayPluginOptions, orderService: OrderService, channelService: ChannelService, paymentMethodService: PaymentMethodService, requestContextService: RequestContextService);
    /**
     * 结算订单支付：dev-notify 和 notify 共用
     * 查询 Authorized 状态的支付并调用 settlePayment
     * 注意：订单到达 PaymentAuthorized 后 active=false，不能用 order.active 判断
     */
    private settleOrderPayment;
    /**
     * 从默认 channel 的 PaymentMethod args + channel override 构造 WxPay 实例
     * 用于通知回调中验签解密
     */
    private buildWxPayFromDefaultChannel;
    /**
     * 生产环境：V3 通知验签 + AES-GCM 解密
     */
    notify(req: Request, res: Response, body: any): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Dev Bypass: 模拟微信支付页面
     */
    getDevPayPage(req: Request, res: Response): void;
    /**
     * Dev Bypass: 自动回调，结算订单
     */
    devNotify(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
