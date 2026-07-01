import { CustomerService, ID, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { RechargeCard } from './recharge-card.entity';
import { RechargeCardBatch } from './recharge-card-batch.entity';
export declare class RechargeCardService {
    private connection;
    private listQueryBuilder;
    private customerService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, customerService: CustomerService);
    getBalance(ctx: RequestContext): Promise<number>;
    addBalance(ctx: RequestContext, customerId: any, amount: number): Promise<number>;
    deductBalance(ctx: RequestContext, customerId: any, amount: number): Promise<{
        success: boolean;
        balance: number;
    }>;
    redeemCard(ctx: RequestContext, code: string, pin?: string): Promise<RechargeCard>;
    findMyCards(ctx: RequestContext): Promise<RechargeCard[]>;
    findAll(ctx: RequestContext, options?: ListQueryOptions<RechargeCard>): Promise<PaginatedList<RechargeCard>>;
    findAllBatches(ctx: RequestContext, options?: ListQueryOptions<RechargeCardBatch>): Promise<PaginatedList<RechargeCardBatch>>;
    createBatch(ctx: RequestContext, input: {
        name: string;
        prefix?: string;
        faceValue: number;
        quantity: number;
        expiresAt?: Date;
    }): Promise<RechargeCardBatch>;
    freezeCard(ctx: RequestContext, id: ID): Promise<RechargeCard>;
    unfreezeCard(ctx: RequestContext, id: ID): Promise<RechargeCard>;
}
