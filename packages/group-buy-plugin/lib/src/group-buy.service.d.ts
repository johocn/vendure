import { ChannelService, ID, Injector, ListQueryBuilder, ListQueryOptions, OrderService, PaginatedList, PaymentService, RequestContext, TransactionalConnection } from '@vendure/core';
import { GroupBuyActivity } from './group-buy-activity.entity';
import { GroupBuyOrder } from './group-buy-order.entity';
export declare class GroupBuyService {
    private connection;
    private listQueryBuilder;
    private channelService;
    private orderService;
    private paymentService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, channelService: ChannelService, orderService: OrderService, paymentService: PaymentService);
    private stockReserveService;
    private stockPrewarmService;
    init(injector: Injector): void;
    findAll(ctx: RequestContext, options?: ListQueryOptions<GroupBuyActivity>): Promise<PaginatedList<GroupBuyActivity>>;
    findOne(ctx: RequestContext, id: ID): Promise<GroupBuyActivity | undefined>;
    create(ctx: RequestContext, input: Partial<GroupBuyActivity>): Promise<GroupBuyActivity>;
    update(ctx: RequestContext, input: any): Promise<GroupBuyActivity>;
    delete(ctx: RequestContext, id: ID): Promise<void>;
    /**
     * 开团/参团一体：
     * 1. 校验订单归属（customer.user.id，勿用 customer.id）
     * 2. 校验活动：存在、非 expired、窗口内、可参（未满 / 已成团且允许续参）
     * 3. 校验订单包含拼团变体行
     * 4. 原子递增 currentCount（防超员，受影响=0 即满员/不可参）
     * 5. 写订单 customFields（groupBuyActivityId + groupBuyIsLeader）并重算价格 → 拼团价立即生效
     * 6. 登记/更新参团记录（同一 orderId 幂等，不重复递增）
     * 7. 达 targetCount → 活动 completed + 全部 pending 参团记录置 success
     */
    joinGroupBuy(ctx: RequestContext, activityId: ID, orderId: ID, isLeader: boolean): Promise<GroupBuyOrder>;
    /**
     * 处理已过 endAt 且仍 active 的活动：
     * - 已成团（currentCount >= targetCount）→ 置 completed（兜底，通常 join 时已处理）
     * - 未成团 → 置 expired，并取消+退款全部 pending 参团订单，参团记录置 failed
     * 返回处理过的活动，便于调用方清理 prewarm 库存。
     */
    processExpired(ctx: RequestContext): Promise<GroupBuyActivity[]>;
    findActiveByVariant(ctx: RequestContext, variantId: ID): Promise<GroupBuyActivity[]>;
    findActive(ctx: RequestContext): Promise<GroupBuyActivity[]>;
    /** 活动成团后，把该活动全部 pending 参团记录置 success */
    private markAllSuccess;
    /** 对订单的 Settled 支付逐个退款（拼团失败/过期） */
    private refundOrderPayments;
}
