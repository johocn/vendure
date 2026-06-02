import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';

import { FlashSaleActivity } from './flash-sale-activity.entity';
import { FlashSaleService } from './flash-sale.service';

@Resolver()
export class FlashSaleShopResolver {
    constructor(private flashSaleService: FlashSaleService) {}

    @Query()
    async activeFlashSaleActivities(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<FlashSaleActivity>,
    ): Promise<PaginatedList<FlashSaleActivity>> {
        return this.flashSaleService.findAll(ctx, {
            ...options,
            filter: {
                ...((options as any)?.filter ?? {}),
                status: { eq: 'active' },
            },
        });
    }

    @Query()
    async flashSaleActivity(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<FlashSaleActivity | undefined> {
        return this.flashSaleService.findOne(ctx, id);
    }
}
