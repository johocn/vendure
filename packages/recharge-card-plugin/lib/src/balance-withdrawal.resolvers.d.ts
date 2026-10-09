import { ID, PaginatedList, RequestContext } from '@vendure/core';
import { BalanceWithdrawalRequest } from './balance-withdrawal-request.entity';
import { BalanceWithdrawalService } from './balance-withdrawal.service';
export declare class BalanceWithdrawalShopResolver {
    private balanceWithdrawalService;
    constructor(balanceWithdrawalService: BalanceWithdrawalService);
    myBalanceWithFrozen(ctx: RequestContext): Promise<{
        balance: number;
        frozenBalance: number;
    }>;
    myBalanceWithdrawals(ctx: RequestContext, options: {
        skip?: number;
        take?: number;
    }): Promise<PaginatedList<BalanceWithdrawalRequest>>;
    requestBalanceWithdrawal(ctx: RequestContext, amount: number, method: 'wechat' | 'alipay' | 'bank', accountInfo: string): Promise<BalanceWithdrawalRequest>;
}
export declare class BalanceWithdrawalAdminResolver {
    private balanceWithdrawalService;
    constructor(balanceWithdrawalService: BalanceWithdrawalService);
    balanceWithdrawals(ctx: RequestContext, options: {
        skip?: number;
        take?: number;
        status?: string;
    }): Promise<PaginatedList<BalanceWithdrawalRequest>>;
    approveBalanceWithdrawal(ctx: RequestContext, id: ID, remark?: string): Promise<BalanceWithdrawalRequest>;
    rejectBalanceWithdrawal(ctx: RequestContext, id: ID, remark?: string): Promise<BalanceWithdrawalRequest>;
    markBalanceWithdrawalPaid(ctx: RequestContext, id: ID): Promise<BalanceWithdrawalRequest>;
}
