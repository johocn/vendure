import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Order, Permission, RelationPaths, Relations, RequestContext } from '@vendure/core';

import { OrderScopeService, ScopedOrderFilter } from './order-scope.service';

@Resolver()
export class OrderScopeAdminResolver {
    constructor(private orderScopeService: OrderScopeService) {}

    @Query()
    @Allow(Permission.ReadOrder)
    async scopedOrders(
        @Ctx() ctx: RequestContext,
        @Args('filter', { nullable: true }) filter?: ScopedOrderFilter,
        @Args('take', { nullable: true, type: () => Number }) take?: number,
        @Args('skip', { nullable: true, type: () => Number }) skip?: number,
        // 与原生 orders 查询同机制：按 GraphQL selection 计算 relations（含 Calculated 字段
        // 依赖如 totalQuantity → lines）传给 service 做关系加载
        @Relations(Order) relations?: RelationPaths<Order>,
    ) {
        return this.orderScopeService.scopedOrders(ctx, filter ?? {}, take ?? 20, skip ?? 0, relations ?? []);
    }

    @Query()
    @Allow(Permission.ReadOrder)
    async scopedOrderCounts(
        @Ctx() ctx: RequestContext,
        @Args('filters', { nullable: true, type: () => [Object] }) filters?: ScopedOrderFilter[],
    ): Promise<number[]> {
        return this.orderScopeService.scopedOrderCounts(ctx, filters ?? []);
    }

    @Query()
    @Allow(Permission.ReadOrder)
    async newOrderSignal(
        @Ctx() ctx: RequestContext,
        @Args('since', { type: () => String }) since: string,
    ) {
        return this.orderScopeService.newOrderSignal(ctx, new Date(since));
    }
}
