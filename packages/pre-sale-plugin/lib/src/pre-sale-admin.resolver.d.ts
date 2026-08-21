import { ID, ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { PreSaleActivity } from './pre-sale-activity.entity';
import { PreSaleService } from './pre-sale.service';
export declare class PreSaleAdminResolver {
    private preSaleService;
    constructor(preSaleService: PreSaleService);
    preSaleActivities(ctx: RequestContext, options: ListQueryOptions<PreSaleActivity>): Promise<PaginatedList<PreSaleActivity>>;
    preSaleActivity(ctx: RequestContext, id: ID): Promise<PreSaleActivity | undefined>;
    createPreSaleActivity(ctx: RequestContext, input: any): Promise<PreSaleActivity>;
    updatePreSaleActivity(ctx: RequestContext, input: any): Promise<PreSaleActivity>;
    deletePreSaleActivity(ctx: RequestContext, id: ID): Promise<boolean>;
    deliverPreSale(ctx: RequestContext, id: ID): Promise<PreSaleActivity>;
}
