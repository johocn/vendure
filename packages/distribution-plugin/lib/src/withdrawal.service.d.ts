import { ID, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { DistributionService } from './distribution.service';
import { WithdrawalRequest } from './withdrawal-request.entity';
export declare class WithdrawalService {
    private connection;
    private listQueryBuilder;
    private distributionService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, distributionService: DistributionService);
    findAll(ctx: RequestContext, options?: ListQueryOptions<WithdrawalRequest>): Promise<PaginatedList<WithdrawalRequest>>;
    findByDistributor(ctx: RequestContext, distributorId: ID, options?: ListQueryOptions<WithdrawalRequest>): Promise<PaginatedList<WithdrawalRequest>>;
    request(ctx: RequestContext, distributorId: ID, amount: number, method: 'bank' | 'alipay' | 'wechat', accountInfo: string): Promise<WithdrawalRequest>;
    /**
     * 审核状态流转：pending → approved → paid，pending/approved → rejected。
     * 用「带原状态条件的原子更新」完成流转，保证并发或重复调用时只有一次能成功——
     * 否则重复 reject 会对同一笔提现二次回补余额，导致可用余额虚增、冻结余额变负。
     * 调用方（resolver）已包 @Transaction()，此处与余额变更同事务。
     */
    private transition;
    approve(ctx: RequestContext, id: ID): Promise<WithdrawalRequest>;
    reject(ctx: RequestContext, id: ID): Promise<WithdrawalRequest>;
    markPaid(ctx: RequestContext, id: ID): Promise<WithdrawalRequest>;
}
