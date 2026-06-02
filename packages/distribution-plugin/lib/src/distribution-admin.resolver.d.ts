import { ID, ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { CommissionRecord } from './commission-record.entity';
import { CommissionService } from './commission.service';
import { Distributor } from './distributor.entity';
import { DistributionService } from './distribution.service';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { WithdrawalService } from './withdrawal.service';
export declare class DistributionAdminResolver {
    private distributionService;
    private commissionService;
    private withdrawalService;
    constructor(distributionService: DistributionService, commissionService: CommissionService, withdrawalService: WithdrawalService);
    distributors(ctx: RequestContext, options: ListQueryOptions<Distributor>): Promise<PaginatedList<Distributor>>;
    commissionRecords(ctx: RequestContext, options: ListQueryOptions<CommissionRecord>): Promise<PaginatedList<CommissionRecord>>;
    withdrawalRequests(ctx: RequestContext, options: ListQueryOptions<WithdrawalRequest>): Promise<PaginatedList<WithdrawalRequest>>;
    approveDistributor(ctx: RequestContext, id: ID): Promise<Distributor>;
    freezeDistributor(ctx: RequestContext, id: ID): Promise<Distributor>;
    approveWithdrawal(ctx: RequestContext, id: ID): Promise<WithdrawalRequest>;
    rejectWithdrawal(ctx: RequestContext, id: ID): Promise<WithdrawalRequest>;
    markWithdrawalPaid(ctx: RequestContext, id: ID): Promise<WithdrawalRequest>;
}
