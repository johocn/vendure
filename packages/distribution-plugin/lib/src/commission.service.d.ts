import { CustomerService, EventBus, ID, ListQueryBuilder, ListQueryOptions, OrderService, PaginatedList, PaymentStateTransitionEvent, RequestContext, TransactionalConnection } from '@vendure/core';
import { CommissionRecord } from './commission-record.entity';
import { DistributionService } from './distribution.service';
export declare class CommissionService {
    private connection;
    private listQueryBuilder;
    private distributionService;
    private eventBus;
    private customerService;
    private orderService;
    private initialized;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, distributionService: DistributionService, eventBus: EventBus, customerService: CustomerService, orderService: OrderService);
    init(): void;
    calculateCommission(event: PaymentStateTransitionEvent): Promise<void>;
    findAll(ctx: RequestContext, options?: ListQueryOptions<CommissionRecord>): Promise<PaginatedList<CommissionRecord>>;
    findByDistributor(ctx: RequestContext, distributorId: ID, options?: ListQueryOptions<CommissionRecord>): Promise<PaginatedList<CommissionRecord>>;
    settlePendingCommissions(ctx: RequestContext): Promise<number>;
    /**
     * 退款冲销：反查 orderId 对应的 CommissionRecord，pending/confirmed 置 cancelled；
     * 已 confirmed 的还需扣回 distributor.availableBalance。
     */
    cancelCommissionByOrder(ctx: RequestContext, orderId: string): Promise<number>;
}
