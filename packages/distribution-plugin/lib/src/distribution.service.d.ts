import { CustomerService, ID, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { Distributor } from './distributor.entity';
export declare class DistributionService {
    private connection;
    private listQueryBuilder;
    private customerService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, customerService: CustomerService);
    findAll(ctx: RequestContext, options?: ListQueryOptions<Distributor>): Promise<PaginatedList<Distributor>>;
    findOne(ctx: RequestContext, id: ID): Promise<Distributor | undefined>;
    findByReferralCode(ctx: RequestContext, referralCode: string): Promise<Distributor | undefined>;
    findByCustomerId(ctx: RequestContext, customerId: ID): Promise<Distributor | undefined>;
    apply(ctx: RequestContext, customerId: ID, referredByCode?: string): Promise<Distributor>;
    approve(ctx: RequestContext, id: ID): Promise<Distributor>;
    freeze(ctx: RequestContext, id: ID): Promise<Distributor>;
    generateReferralCode(): string;
    getTeamSummary(ctx: RequestContext, distributorId: ID): Promise<TeamSummary>;
}
export interface TeamSummary {
    directTeamSize: number;
    indirectTeamSize: number;
    totalTeamSize: number;
    orderCount: number;
    orderAmount: number;
    teamCommission: number;
}
