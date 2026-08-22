import { CustomerService, ID, ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { CommissionRecord } from './commission-record.entity';
import { CommissionService } from './commission.service';
import { Distributor } from './distributor.entity';
import { DistributionService } from './distribution.service';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { WithdrawalService } from './withdrawal.service';
/**
 * 后台结算/打款操作（挂载到 shop-api，供 vshop 后台管理页使用）。
 * 权限由 @Allow 门控（SuperAdmin / 客户读改），模式照搬 marketplace shop.resolver。
 */
export declare class DistributionAdminShopResolver {
    private distributionService;
    private commissionService;
    private withdrawalService;
    private customerService;
    constructor(distributionService: DistributionService, commissionService: CommissionService, withdrawalService: WithdrawalService, customerService: CustomerService);
    distributors(ctx: RequestContext, options: ListQueryOptions<Distributor>): Promise<PaginatedList<Distributor & {
        customerEmail: string | null;
    }>>;
    commissionRecords(ctx: RequestContext, options: ListQueryOptions<CommissionRecord>): Promise<PaginatedList<CommissionRecord>>;
    withdrawalRequests(ctx: RequestContext, options: ListQueryOptions<WithdrawalRequest>): Promise<PaginatedList<WithdrawalRequest>>;
    settleCommissionsNow(ctx: RequestContext): Promise<number>;
    approveDistributor(ctx: RequestContext, id: ID): Promise<Distributor>;
    freezeDistributor(ctx: RequestContext, id: ID): Promise<Distributor>;
    approveWithdrawal(ctx: RequestContext, id: ID): Promise<WithdrawalRequest>;
    rejectWithdrawal(ctx: RequestContext, id: ID): Promise<WithdrawalRequest>;
    markWithdrawalPaid(ctx: RequestContext, id: ID): Promise<WithdrawalRequest>;
}
