import { RequestContext } from '@vendure/core';
import { Injectable } from '@nestjs/common';

/** 基于 out_trade_no 的非订单支付结算器 */
export interface WechatpaySettlement {
    /** out_trade_no 前缀，如 'RC-' */
    readonly prefix: string;
    settle(ctx: RequestContext, outTradeNo: string, transactionId: string): Promise<void>;
}

@Injectable()
export class WechatpaySettlementRegistry {
    private handlers: WechatpaySettlement[] = [];
    register(h: WechatpaySettlement): void {
        if (!this.handlers.some(x => x.prefix === h.prefix)) {
            this.handlers.push(h);
        }
    }
    find(outTradeNo: string): WechatpaySettlement | undefined {
        return this.handlers.find(h => outTradeNo.startsWith(h.prefix));
    }
}