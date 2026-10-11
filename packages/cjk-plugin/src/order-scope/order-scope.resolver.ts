import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

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
    ) {
        return this.orderScopeService.scopedOrders(ctx, filter ?? {}, take ?? 20, skip ?? 0);
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
