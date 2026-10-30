import { CustomerService, ID, ListQueryBuilder, Order, OrderService, PaginatedList, PaymentService, RequestContext, StockMovementService, TransactionalConnection } from '@vendure/core';
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
export declare class MyOrdersShopResolver {
    private customerService;
    private listQueryBuilder;
    private orderService;
    private stockMovementService;
    private paymentService;
    private connection;
    constructor(customerService: CustomerService, listQueryBuilder: ListQueryBuilder, orderService: OrderService, stockMovementService: StockMovementService, paymentService: PaymentService, connection: TransactionalConnection);
    myOrders(ctx: RequestContext, options: any, relations: string[]): Promise<PaginatedList<Order>>;
    /**
     * C 端「取消订单」：
     * - 未支付/未履约（Created/AddingItems/ArrangingPayment）：释放库存分配后整体取消；
     *   core 的 cancelOrder 对 active 订单（如 ArrangingPayment）不会释放库存分配，
     *   需先显式释放，否则取消后库存被永久占用（与 order-timeout-plugin 同一处理）。
     * - 已下单未支付（PaymentAuthorized）：先逐笔取消未结算支付（Authorized → Cancelled），
     *   再整体取消订单（已下单单走 cancelOrderByOrderLines，幂等释放分配）。
     *   守卫：任一支付已结算（Settled）→ 拒绝（实付单走售后退款）；含酒店行 → 拒绝
     *   （走 OrderHotelCancelModal 专用取消/退款流程，避免预订单悬空）。
     * - 已实付外卖单（PaymentSettled）：仅「未开始履约」窗口（hallStatus=空/scheduled/pending_merchant/open，
     *   且无骑手/无外部运单/未送达）允许自助取消；全额退款后取消订单，由取消事件自动脱厅/释放时段锁。
     *   已接单、已出餐、已抢单、已推送外部快递、已送达一律拒绝（提示走售后）。
     */
    cancelMyOrder(ctx: RequestContext, orderId: ID): Promise<Order>;
    /**
     * 已实付外卖单自助取消：退款 + 取消。
     * 用订单级 PG 咨询锁串行化，避免与商家拒单 / T4 无人接单退款 / 调度超时兜底并发时重复退款。
     * 退款口径与 campus 一致：只退 Settled/Authorized 且仍有余额的支付单（排除 Failed 退款单）。
     * 取消后由 campus 插件的 Cancelled 事件自动脱厅、取消外部运单、释放时段锁位。
     */
    private cancelPaidOrder;
    /** 校验「已支付且尚未开始履约」：任何履约动作出现即拒绝自助取消 */
    private assertPaidCancelable;
    /** 全额退款：逐笔退剩余额度；refundOrder 停在 Pending 时推进到 Settled，未达 Settled 视为失败 */
    private refundAllPaid;
}
