import { ID, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { Distributor } from './distributor.entity';
export declare class DistributionService {
    private connection;
    private listQueryBuilder;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder);
    findAll(ctx: RequestContext, options?: ListQueryOptions<Distributor>): Promise<PaginatedList<Distributor>>;
    findOne(ctx: RequestContext, id: ID): Promise<Distributor | undefined>;
    findByReferralCode(ctx: RequestContext, referralCode: string): Promise<Distributor | undefined>;
    findByCustomerId(ctx: RequestContext, customerId: ID): Promise<Distributor | undefined>;
    apply(ctx: RequestContext, customerId: ID, referredByCode?: string): Promise<Distributor>;
    approve(ctx: RequestContext, id: ID): Promise<Distributor>;
    freeze(ctx: RequestContext, id: ID): Promise<Distributor>;
    generateReferralCode(): string;
}
