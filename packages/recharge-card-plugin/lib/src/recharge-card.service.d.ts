import { CustomerService, ID, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { RechargeCard } from './recharge-card.entity';
import { RechargeCardBatch } from './recharge-card-batch.entity';
import { BalanceTransactionType } from './balance-transaction.entity';
export declare class RechargeCardService {
    private connection;
    private listQueryBuilder;
    private customerService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, customerService: CustomerService);
    getBalance(ctx: RequestContext): Promise<number>;
    addBalance(ctx: RequestContext, customerId: any, amount: number, orderId?: ID | null, paymentId?: ID | null, type?: BalanceTransactionType): Promise<number>;
    deductBalance(ctx: RequestContext, customerId: any, amount: number, orderId?: ID | null, paymentId?: ID | null): Promise<number>;
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
    /**
     * Applies an atomic balance change and records a BalanceTransaction.
     * Must be called within an already-started transaction.
     * `delta` > 0 adds balance, `delta` < 0 deducts (with sufficiency check).
     * Returns the balance after the change.
     */
    private applyBalanceChange;
}
