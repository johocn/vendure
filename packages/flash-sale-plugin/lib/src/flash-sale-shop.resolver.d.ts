import { ID, Order, RequestContext } from '@vendure/core';
import { FlashSaleActivity } from './flash-sale-activity.entity';
import { FlashSaleService } from './flash-sale.service';
export declare class FlashSaleShopResolver {
    private flashSaleService;
    constructor(flashSaleService: FlashSaleService);
    activeFlashSaleActivities(ctx: RequestContext): Promise<FlashSaleActivity[]>;
    applyFlashSale(ctx: RequestContext, activityId: ID): Promise<Order>;
}
