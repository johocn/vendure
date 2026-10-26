import { ID, RequestContext } from '@vendure/core';
import { BillPayService } from './bill-pay.service';
import { BillPayStatus } from './types';
/**
 * 代买单（shop-api）：客户提交委托、取消、支付（微信/余额）、我的委托单。
 * 归属校验（本人/本渠道）在 BillPayService 内完成；自动报价在创建时同步返回。
 */
export declare class BillPayShopResolver {
    private billPayService;
    constructor(billPayService: BillPayService);
    billPayOrder(ctx: RequestContext, id: ID): Promise<any>;
    billPayOrders(ctx: RequestContext, options?: {
        skip?: number;
        take?: number;
        status?: BillPayStatus;
    }): Promise<{
        items: any[];
        totalItems: number;
    }>;
    billPayConfig(ctx: RequestContext): Promise<import("./types").BillPayChannelConfig>;
    createBillPayOrder(ctx: RequestContext, input: {
        merchantName: string;
        expectedAmount: number;
        remark?: string;
        couponCode?: string | null;
    }): Promise<any>;
    cancelBillPayOrder(ctx: RequestContext, id: ID): Promise<any>;
    createWechatBillPayment(ctx: RequestContext, id: ID, tradeType?: string, openid?: string): Promise<any>;
    payBillPayOrderWithBalance(ctx: RequestContext, id: ID): Promise<any>;
}
