import { EventBus, ID, ListQueryBuilder, ListQueryOptions, PaginatedList, PaymentStateTransitionEvent, RequestContext, TransactionalConnection } from '@vendure/core';
import { CommissionRecord } from './commission-record.entity';
import { DistributionService } from './distribution.service';
export declare class CommissionService {
    private connection;
    private listQueryBuilder;
    private distributionService;
    private eventBus;
    private initialized;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, distributionService: DistributionService, eventBus: EventBus);
    init(): void;
    calculateCommission(event: PaymentStateTransitionEvent): Promise<void>;
    findAll(ctx: RequestContext, options?: ListQueryOptions<CommissionRecord>): Promise<PaginatedList<CommissionRecord>>;
    findByDistributor(ctx: RequestContext, distributorId: ID, options?: ListQueryOptions<CommissionRecord>): Promise<PaginatedList<CommissionRecord>>;
    settlePendingCommissions(ctx: RequestContext): Promise<number>;
}
