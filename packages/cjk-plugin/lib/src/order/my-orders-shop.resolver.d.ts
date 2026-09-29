import { CustomerService, ListQueryBuilder, Order, PaginatedList, RequestContext } from '@vendure/core';
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
 */
export declare class MyOrdersShopResolver {
    private customerService;
    private listQueryBuilder;
    constructor(customerService: CustomerService, listQueryBuilder: ListQueryBuilder);
    myOrders(ctx: RequestContext, options?: any): Promise<PaginatedList<Order>>;
}
