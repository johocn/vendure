import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    CustomerService,
    EntityNotFoundError,
    ForbiddenError,
    ID,
    isGraphQlErrorResult,
    ListQueryBuilder,
    Logger,
    Order,
    OrderService,
    PaginatedList,
    Payment,
    PaymentService,
    Permission,
    Relations as GraphQLRelations,
    RequestContext,
    StockMovementService,
    Transaction,
    TransactionalConnection,
    UnauthorizedError,
    UserInputError,
} from '@vendure/core';

const loggerCtx = 'MyOrdersShopResolver';

/** 顾客可自行取消的订单状态（尚未支付/未进入履约） */
const CUSTOMER_CANCELLABLE_STATES = ['Created', 'AddingItems', 'ArrangingPayment'];
/** 已下单未支付（支付已授权未结算）也允许顾客自助取消 */
const UNPAID_AUTHORIZED_STATE = 'PaymentAuthorized';

/**
 * C 端「我的订单」列表查询。
 *
 * 前端 `vshop/src/api/queries/order.ts#getOrders` 一直在发
 * `myOrders(options: OrderListOptions): OrderList!`，但生产 shop-api 上从未注册过该字段，
 * 导致「我的订单」页恒空。此处补齐字段并用当前登录用户反查 customer，严格按顾客隔离，
 * 拿不到顾客即返回空列表（绝不返回全站订单，防串号）。
 *
 * 排除 Draft（草稿单）与 AddingItems（顾客正在编辑的购物车单），
 * 保留 ArrangingPayment 及之后所有已下单状态。
 *
 * 关系不用手写列表，而是走 core 的 `@Relations(Order)` 装饰器：它按本次 GraphQL 查询的
 * 选择集推导所需关系，并带上 `@Calculated()` 属性（taxSummary / discounts / totalQuantity）
 * 声明的关系依赖。手写列表一旦漏项（如漏 `surcharges`）就会整条查询报
 * 「property "taxSummary" ... requires the Order.surcharges relation to be joined」，
 * 前端只会表现为「暂无订单」，难以定位。
 */
@Resolver()
export class MyOrdersShopResolver {
    constructor(
        private customerService: CustomerService,
        private listQueryBuilder: ListQueryBuilder,
        private orderService: OrderService,
        private stockMovementService: StockMovementService,
        private paymentService: PaymentService,
        private connection: TransactionalConnection,
    ) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myOrders(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: any,
        @GraphQLRelations(Order) relations: string[],
    ): Promise<PaginatedList<Order>> {
        if (!ctx.activeUserId) {
            return { items: [], totalItems: 0 };
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            return { items: [], totalItems: 0 };
        }
        const effectiveOptions = options ?? { take: 10, sort: { createdAt: 'DESC' } };
        return this.listQueryBuilder
            .build(Order, effectiveOptions, { ctx, channelId: ctx.channelId, relations })
            .andWhere('order.customer.id = :customerId', { customerId: customer.id })
            .andWhere('order.state NOT IN (:...excludedStates)', {
                excludedStates: ['Draft', 'AddingItems'],
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    /**
     * C 端「取消订单」：
     * - 未支付/未履约（Created/AddingItems/ArrangingPayment）：释放库存分配后整体取消；
     *   core 的 cancelOrder 对 active 订单（如 ArrangingPayment）不会释放库存分配，
     *   需先显式释放，否则取消后库存被永久占用（与 order-timeout-plugin 同一处理）。
     * - 已下单未支付（PaymentAuthorized）：先逐笔取消未结算支付（Authorized → Cancelled），
     *   再整体取消订单（已下单单走 cancelOrderByOrderLines，幂等释放分配）。
     *   守卫：任一支付已结算（Settled）→ 拒绝（实付单走售后退款）；含酒店行 → 拒绝
     *   （走 OrderHotelCancelModal 专用取消/退款流程，避免预订单悬空）。
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async cancelMyOrder(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID): Promise<Order> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user', 'lines']);
        if (!order) {
            throw new EntityNotFoundError('Order', orderId);
        }
        // 归属校验：order.customer.id 是 Customer 主键，与 activeUserId（User 主键）不同，须比 customer.user.id
        const customerUserId = (order.customer as any)?.user?.id;
        if (!order.customer || customerUserId == null || String(customerUserId) !== String(ctx.activeUserId)) {
            throw new ForbiddenError();
        }
        if (!CUSTOMER_CANCELLABLE_STATES.includes(order.state) && order.state !== UNPAID_AUTHORIZED_STATE) {
            throw new UserInputError(`ORDER_CANNOT_BE_CANCELLED:${order.state}`);
        }
        if (order.state === UNPAID_AUTHORIZED_STATE) {
            // 含酒店行的已下单单走酒店专用取消/退款（预订单锁房/截止点独立收口），不开放自助取消
            const hasHotelLine = (order.lines ?? []).some(l => {
                const cf = (l as any).customFields;
                return !!cf?.hotelCheckIn && !!cf?.hotelCheckOut;
            });
            if (hasHotelLine) {
                throw new UserInputError(`ORDER_CANNOT_BE_CANCELLED:${order.state}`);
            }
            const payments = await this.connection
                .getRepository(ctx, Payment)
                .find({ where: { order: { id: order.id } } });
            // 全部支付须处于 Authorized（或历史已 Cancelled 的重试幂等）；Settled 实付/Declined/Error 异常态拒绝
            if (payments.length === 0 || payments.some(p => p.state !== 'Authorized' && p.state !== 'Cancelled')) {
                throw new UserInputError(`ORDER_CANNOT_BE_CANCELLED:${order.state}`);
            }
            for (const payment of payments) {
                if (payment.state === 'Cancelled') {
                    continue;
                }
                const cancelled = await this.paymentService.cancelPayment(ctx, payment.id);
                if (isGraphQlErrorResult(cancelled) || cancelled.state !== 'Cancelled') {
                    Logger.warn(`取消订单支付失败 order#${orderId} payment#${payment.id}`, loggerCtx);
                    throw new UserInputError('PAYMENT_CANCEL_FAILED');
                }
            }
            const unpaidResult = await this.orderService.cancelOrder(ctx, { orderId });
            if (isGraphQlErrorResult(unpaidResult)) {
                Logger.warn(`取消订单失败 order#${orderId}: ${unpaidResult.message}`, loggerCtx);
                throw new UserInputError(unpaidResult.message);
            }
            return unpaidResult;
        }
        const lines = (order.lines ?? []).map(l => ({ orderLineId: l.id, quantity: l.quantity }));
        if (lines.length > 0) {
            await this.stockMovementService.createReleasesForOrderLines(ctx, lines);
        }
        const result = await this.orderService.cancelOrder(ctx, { orderId });
        if (isGraphQlErrorResult(result)) {
            Logger.warn(`取消订单失败 order#${orderId}: ${result.message}`, loggerCtx);
            throw new UserInputError(result.message);
        }
        return result;
    }
}
