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
    /**
     * 订单取消时回滚库存：Redis 路径走 StockReserveService，DB 路径走原子 UPDATE。
     */
    releaseStock(ctx: RequestContext, activityId: ID, quantity: number): Promise<void>;
    /**
     * DB fallback 原子预占：UPDATE ... SET soldCount = soldCount + quantity
     * WHERE id = ? AND soldCount + quantity <= totalStock。
     * 返回是否成功扣减（affected > 0）。
     */
    private reserveStockAtomic;
    /**
     * DB fallback 原子回滚：资格未通过或订单取消时，回滚预占的库存。
     * 使用 WHERE soldCount - quantity >= 0 防止负数。
     */
    private releaseStockAtomic;
}
