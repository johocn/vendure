import { ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { CommissionRecord } from './commission-record.entity';
import { CommissionService } from './commission.service';
import { Distributor } from './distributor.entity';
import { DistributionService } from './distribution.service';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { WithdrawalService } from './withdrawal.service';
export declare class DistributionShopResolver {
    private distributionService;
    private commissionService;
    private withdrawalService;
    constructor(distributionService: DistributionService, commissionService: CommissionService, withdrawalService: WithdrawalService);
    myDistributorProfile(ctx: RequestContext): Promise<Distributor | undefined>;
    myCommissionRecords(ctx: RequestContext, options: ListQueryOptions<CommissionRecord>): Promise<PaginatedList<CommissionRecord>>;
    myWithdrawalRequests(ctx: RequestContext, options: ListQueryOptions<WithdrawalRequest>): Promise<PaginatedList<WithdrawalRequest>>;
    applyDistributor(ctx: RequestContext, referredByCode?: string): Promise<Distributor>;
    requestWithdrawal(ctx: RequestContext, amount: number, method: 'bank' | 'alipay' | 'wechat', accountInfo: string): Promise<WithdrawalRequest>;
}
