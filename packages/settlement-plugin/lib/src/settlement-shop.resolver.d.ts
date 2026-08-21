import { RequestContext } from '@vendure/core';
import { MerchantAccount } from './merchant-account.entity';
import { SettlementEntry } from './settlement-entry.entity';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { SettlementService } from './settlement.service';
import { ListOptions, SettlementSummary } from './types';
/** 店主自营后台（ADMIN API）：财务对账 + 提现。归属隔离由 service 按 Shop.administratorId。 */
export declare class SettlementShopResolver {
    private settlementService;
    constructor(settlementService: SettlementService);
    myMerchantAccount(ctx: RequestContext): Promise<MerchantAccount>;
    mySettlementEntries(ctx: RequestContext, options: ListOptions): Promise<{
        items: SettlementEntry[];
        totalItems: number;
    }>;
    myWithdrawalRequests(ctx: RequestContext, options: ListOptions): Promise<{
        items: WithdrawalRequest[];
        totalItems: number;
    }>;
    mySettlementSummary(ctx: RequestContext, from: Date, to: Date): Promise<SettlementSummary>;
    requestWithdrawal(ctx: RequestContext, amount: number): Promise<WithdrawalRequest>;
}
