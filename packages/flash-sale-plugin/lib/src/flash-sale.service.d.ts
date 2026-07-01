import { ID, Injector, ListQueryBuilder, ListQueryOptions, OrderService, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { FlashSaleActivity } from './flash-sale-activity.entity';
export declare class FlashSaleService {
    private connection;
    private listQueryBuilder;
    private orderService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, orderService: OrderService);
    private stockReserveService;
    init(injector: Injector): void;
    findAll(ctx: RequestContext, options?: ListQueryOptions<FlashSaleActivity>): Promise<PaginatedList<FlashSaleActivity>>;
    findOne(ctx: RequestContext, id: ID): Promise<FlashSaleActivity | undefined>;
    create(ctx: RequestContext, input: Partial<FlashSaleActivity>): Promise<FlashSaleActivity>;
    update(ctx: RequestContext, input: any): Promise<FlashSaleActivity>;
    delete(ctx: RequestContext, id: ID): Promise<void>;
    checkEligibility(ctx: RequestContext, activityId: ID, customerId: ID): Promise<{
        eligible: boolean;
        reason?: string;
    }>;
    findActive(ctx: RequestContext): Promise<FlashSaleActivity[]>;
    findActiveByVariant(ctx: RequestContext, variantId: ID): Promise<FlashSaleActivity | undefined>;
    incrementSoldCount(ctx: RequestContext, activityId: ID, quantity: number): Promise<void>;
}
