import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, Order, RequestContext, Transaction } from '@vendure/core';

import { PreSaleActivity } from './pre-sale-activity.entity';
import { PreSaleService } from './pre-sale.service';

@Resolver()
export class PreSaleShopResolver {
    constructor(private preSaleService: PreSaleService) {}

    @Query()
    async activePreSaleActivities(@Ctx() ctx: RequestContext): Promise<PreSaleActivity[]> {
        const result = await this.preSaleService.findActive(ctx);
        return result ?? [];
    }

    @Mutation()
    @Transaction()
    async applyPreSale(
        @Ctx() ctx: RequestContext,
        @Args('activityId') activityId: ID,
    ): Promise<Order> {
        return this.preSaleService.applyPreSale(ctx, activityId);
    }

    @Mutation()
    @Transaction()
    async payPreSaleFull(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('method') method: string,
    ): Promise<Order> {
        return this.preSaleService.payPreSaleFull(ctx, orderId, method);
    }

    @Mutation()
    @Transaction()
    async payPreSaleDeposit(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('method') method: string,
    ): Promise<Order> {
        return this.preSaleService.payPreSaleDeposit(ctx, orderId, method);
    }

    @Mutation()
    @Transaction()
    async payPreSaleTail(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('method') method: string,
    ): Promise<Order> {
        return this.preSaleService.payPreSaleTail(ctx, orderId, method);
    }
}