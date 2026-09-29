import { Args, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    CustomerService,
    ListQueryBuilder,
    Order,
    PaginatedList,
    Permission,
    RequestContext,
} from '@vendure/core';

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
@Resolver()
export class MyOrdersShopResolver {
    constructor(
        private customerService: CustomerService,
        private listQueryBuilder: ListQueryBuilder,
    ) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myOrders(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options?: any,
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
            .build(Order, effectiveOptions, {
                ctx,
                channelId: ctx.channelId,
                relations: [
                    'lines',
                    'lines.productVariant',
                    'lines.featuredAsset',
                    'lines.productVariant.featuredAsset',
                    'shippingLines',
                    'payments',
                    'customer',
                ],
            })
            .andWhere('order.customer.id = :customerId', { customerId: customer.id })
            .andWhere('order.state NOT IN (:...excludedStates)', {
                excludedStates: ['Draft', 'AddingItems'],
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
}
