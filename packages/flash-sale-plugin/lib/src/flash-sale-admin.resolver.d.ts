import { ID, ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { FlashSaleActivity } from './flash-sale-activity.entity';
import { FlashSaleService } from './flash-sale.service';
export declare class FlashSaleAdminResolver {
    private flashSaleService;
    constructor(flashSaleService: FlashSaleService);
    flashSaleActivities(ctx: RequestContext, options: ListQueryOptions<FlashSaleActivity>): Promise<PaginatedList<FlashSaleActivity>>;
    flashSaleActivity(ctx: RequestContext, id: ID): Promise<FlashSaleActivity | undefined>;
    createFlashSaleActivity(ctx: RequestContext, input: any): Promise<FlashSaleActivity>;
    updateFlashSaleActivity(ctx: RequestContext, input: any): Promise<FlashSaleActivity>;
    deleteFlashSaleActivity(ctx: RequestContext, id: ID): Promise<boolean>;
}
