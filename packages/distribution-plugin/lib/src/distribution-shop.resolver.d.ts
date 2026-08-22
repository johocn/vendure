import { CustomerService, ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { CommissionRecord } from './commission-record.entity';
import { CommissionService } from './commission.service';
import { Distributor } from './distributor.entity';
import { DistributionService, TeamSummary } from './distribution.service';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { WithdrawalService } from './withdrawal.service';
export declare class DistributionShopResolver {
    private distributionService;
    private commissionService;
    private withdrawalService;
    private customerService;
    constructor(distributionService: DistributionService, commissionService: CommissionService, withdrawalService: WithdrawalService, customerService: CustomerService);
    /**
     * shop-api 会话的 ctx.activeUserId 是 User 的 id，而 Distributor.customerId 存的是 Customer 的 id，
     * 二者数字空间重叠会错配。统一经 findOneByUserId 解析出真实 customer id。
     */
    private resolveCustomerId;
    myDistributorProfile(ctx: RequestContext): Promise<Distributor | undefined>;
    myCommissionRecords(ctx: RequestContext, options: ListQueryOptions<CommissionRecord>): Promise<PaginatedList<CommissionRecord>>;
    myWithdrawalRequests(ctx: RequestContext, options: ListQueryOptions<WithdrawalRequest>): Promise<PaginatedList<WithdrawalRequest>>;
    myTeamSummary(ctx: RequestContext): Promise<TeamSummary>;
    applyDistributor(ctx: RequestContext, referredByCode?: string): Promise<Distributor>;
    requestWithdrawal(ctx: RequestContext, amount: number, method: 'bank' | 'alipay' | 'wechat', accountInfo: string): Promise<WithdrawalRequest>;
}
