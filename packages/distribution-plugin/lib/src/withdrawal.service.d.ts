import { ID, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { DistributionService } from './distribution.service';
export declare class WithdrawalService {
    private connection;
    private listQueryBuilder;
    private distributionService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, distributionService: DistributionService);
    findAll(ctx: RequestContext, options?: ListQueryOptions<WithdrawalRequest>): Promise<PaginatedList<WithdrawalRequest>>;
    findByDistributor(ctx: RequestContext, distributorId: ID, options?: ListQueryOptions<WithdrawalRequest>): Promise<PaginatedList<WithdrawalRequest>>;
    request(ctx: RequestContext, distributorId: ID, amount: number, method: 'bank' | 'alipay' | 'wechat', accountInfo: string): Promise<WithdrawalRequest>;
    approve(ctx: RequestContext, id: ID): Promise<WithdrawalRequest>;
    reject(ctx: RequestContext, id: ID): Promise<WithdrawalRequest>;
    markPaid(ctx: RequestContext, id: ID): Promise<WithdrawalRequest>;
}
