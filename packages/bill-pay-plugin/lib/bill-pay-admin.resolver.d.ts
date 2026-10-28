import { ID, RequestContext } from '@vendure/core';
import { BillPayService } from './bill-pay.service';
import { BillPayStatus } from './types';
/**
 * 代买单工作台（admin-api）：改价、接单、凭证回传、结算、人工退款，
 * 以及商家协议 / 渠道配置维护。权限为自定义 BillPayManage（注册于 plugin configuration）。
 */
export declare class BillPayAdminResolver {
    private billPayService;
    constructor(billPayService: BillPayService);
    billPayOrdersAdmin(ctx: RequestContext, options?: {
        skip?: number;
        take?: number;
        status?: BillPayStatus;
    }): Promise<{
        items: any[];
        totalItems: number;
    }>;
    billPayOrderAdmin(ctx: RequestContext, id: ID): Promise<any>;
    billPayChannelConfig(ctx: RequestContext): Promise<import("./types").BillPayChannelConfig>;
    merchantAgreements(ctx: RequestContext): Promise<import("./merchant-agreement.entity").MerchantAgreement[]>;
    updateBillPayQuote(ctx: RequestContext, id: ID, quoteAmount: number, note: string): Promise<any>;
    acceptBillPayOrder(ctx: RequestContext, id: ID): Promise<any>;
    completeBillPayOrder(ctx: RequestContext, id: ID, actualAmount: number, proofUrl: string, note?: string): Promise<any>;
    settleBillPayOrder(ctx: RequestContext, id: ID): Promise<any>;
    refundBillPayOrder(ctx: RequestContext, id: ID, reason?: string): Promise<any>;
    saveMerchantAgreement(ctx: RequestContext, input: {
        merchantName: string;
        merchantId?: string | number | null;
        settleRate: number;
        settleMode?: string;
        contact?: string;
        note?: string;
    }, id?: ID): Promise<import("./merchant-agreement.entity").MerchantAgreement>;
    saveBillPayChannelConfig(ctx: RequestContext, config: any): Promise<import("./types").BillPayChannelConfig>;
}
