import { ID, RequestContext } from '@vendure/core';
import { MerchantAccount } from './merchant-account.entity';
import { SettlementEntry } from './settlement-entry.entity';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { SettlementService } from './settlement.service';
import { ListOptions } from './types';
/** 平台管理端（ADMIN API）：全部商户账户/明细/提现审核/佣金配置。 */
export declare class SettlementAdminResolver {
    private settlementService;
    constructor(settlementService: SettlementService);
    merchantAccounts(ctx: RequestContext, options: ListOptions): Promise<{
        items: MerchantAccount[];
        totalItems: number;
    }>;
    settlementEntriesByShop(ctx: RequestContext, shopId: ID, options: ListOptions): Promise<{
        items: SettlementEntry[];
        totalItems: number;
    }>;
    withdrawalRequests(ctx: RequestContext, options: ListOptions): Promise<{
        items: WithdrawalRequest[];
        totalItems: number;
    }>;
    approveWithdrawal(ctx: RequestContext, id: ID): Promise<WithdrawalRequest>;
    payWithdrawal(ctx: RequestContext, id: ID): Promise<WithdrawalRequest>;
    rejectWithdrawal(ctx: RequestContext, id: ID, note: string): Promise<WithdrawalRequest>;
    setMerchantCommissionRate(ctx: RequestContext, shopId: ID, rate: number): Promise<MerchantAccount>;
}
