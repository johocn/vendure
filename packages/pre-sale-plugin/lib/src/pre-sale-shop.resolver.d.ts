import { ID, Order, RequestContext } from '@vendure/core';
import { PreSaleActivity } from './pre-sale-activity.entity';
import { PreSaleService } from './pre-sale.service';
export declare class PreSaleShopResolver {
    private preSaleService;
    constructor(preSaleService: PreSaleService);
    activePreSaleActivities(ctx: RequestContext): Promise<PreSaleActivity[]>;
    applyPreSale(ctx: RequestContext, activityId: ID): Promise<Order>;
    payPreSaleFull(ctx: RequestContext, orderId: ID, method: string): Promise<Order>;
    payPreSaleDeposit(ctx: RequestContext, orderId: ID, method: string): Promise<Order>;
    payPreSaleTail(ctx: RequestContext, orderId: ID, method: string): Promise<Order>;
}
