import { ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { BalanceTransaction } from './balance-transaction.entity';
import { RechargeCardService } from './recharge-card.service';
export declare class RechargeOrderResolver {
    private rechargeCardService;
    constructor(rechargeCardService: RechargeCardService);
    myRechargeOrders(ctx: RequestContext): Promise<any[]>;
    myBalanceTransactions(ctx: RequestContext, options: ListQueryOptions<BalanceTransaction>): Promise<PaginatedList<BalanceTransaction>>;
    createRechargeOrder(ctx: RequestContext, amount: number, remark: string): Promise<any>;
    payRechargeOrder(ctx: RequestContext, id: number): Promise<any>;
    cancelRechargeOrder(ctx: RequestContext, id: number): Promise<any>;
    createWechatRechargePayment(ctx: RequestContext, rechargeOrderId: number, tradeType?: string, openid?: string): Promise<any>;
}
