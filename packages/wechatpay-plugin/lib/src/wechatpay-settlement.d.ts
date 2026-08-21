import { RequestContext } from '@vendure/core';
/** 基于 out_trade_no 的非订单支付结算器 */
export interface WechatpaySettlement {
    /** out_trade_no 前缀，如 'RC-' */
    readonly prefix: string;
    settle(ctx: RequestContext, outTradeNo: string, transactionId: string): Promise<void>;
}
export declare class WechatpaySettlementRegistry {
    private handlers;
    register(h: WechatpaySettlement): void;
    find(outTradeNo: string): WechatpaySettlement | undefined;
}
