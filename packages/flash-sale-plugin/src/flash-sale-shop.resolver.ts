import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, Order, RequestContext, Transaction } from '@vendure/core';

import { FlashSaleActivity } from './flash-sale-activity.entity';
import { FlashSaleService } from './flash-sale.service';

@Resolver()
export class FlashSaleShopResolver {
    constructor(private flashSaleService: FlashSaleService) {}

    @Query()
    async activeFlashSaleActivities(
        @Ctx() ctx: RequestContext,
    ): Promise<FlashSaleActivity[]> {
        const result = await this.flashSaleService.findActive(ctx);
        return result ?? [];
    }

    @Mutation()
    @Transaction()
    async applyFlashSale(
        @Ctx() ctx: RequestContext,
        @Args('activityId') activityId: ID,
    ): Promise<Order> {
        return this.flashSaleService.applyFlashSale(ctx, activityId);
    }
}