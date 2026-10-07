import { CustomerService, ID, ListQueryBuilder, Order, OrderService, PaginatedList, RequestContext, StockMovementService } from '@vendure/core';
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
    constructor(customerService: CustomerService, listQueryBuilder: ListQueryBuilder, orderService: OrderService, stockMovementService: StockMovementService);
    myOrders(ctx: RequestContext, options: any, relations: string[]): Promise<PaginatedList<Order>>;
    /**
     * C 端「取消订单」：仅限本人、且处于未支付/未履约状态（Created/AddingItems/ArrangingPayment）。
     * core 的 cancelOrder 对 active 订单（如 ArrangingPayment）不会释放库存分配，
     * 需先显式释放分配，否则取消后库存被永久占用（与 order-timeout-plugin 同一处理）。
     */
    cancelMyOrder(ctx: RequestContext, orderId: ID): Promise<Order>;
}
