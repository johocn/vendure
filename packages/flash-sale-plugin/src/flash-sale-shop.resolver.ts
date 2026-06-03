import { Query, Resolver } from '@nestjs/graphql';
import { Ctx, Logger, RequestContext } from '@vendure/core';

import { loggerCtx } from './constants';
import { FlashSaleActivity } from './flash-sale-activity.entity';
import { FlashSaleService } from './flash-sale.service';

@Resolver()
export class FlashSaleShopResolver {
    constructor(private flashSaleService: FlashSaleService) {}

    @Query()
    async activeFlashSaleActivities(
        @Ctx() ctx: RequestContext,
    ): Promise<FlashSaleActivity[]> {
        try {
            const result = await this.flashSaleService.findActive(ctx);
            Logger.info(`activeFlashSaleActivities returned ${result?.length ?? 'null'} items`, loggerCtx);
            return result ?? [];
        } catch (e: any) {
            Logger.error(`activeFlashSaleActivities error: ${e.message}`, loggerCtx);
            return [];
        }
    }
}