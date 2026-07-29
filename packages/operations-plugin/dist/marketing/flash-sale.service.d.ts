import { ID, ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { FlashSaleService } from '@vendure/flash-sale-plugin';
export declare class FlashSaleMarketingService {
    private flashSaleService;
    constructor(flashSaleService: FlashSaleService);
    private assertPermission;
    findAll(ctx: RequestContext, options?: ListQueryOptions<any>): Promise<PaginatedList<any>>;
    findOne(ctx: RequestContext, id: ID): Promise<any | undefined>;
    create(ctx: RequestContext, input: any): Promise<any>;
    update(ctx: RequestContext, input: any): Promise<any>;
    delete(ctx: RequestContext, id: ID): Promise<boolean>;
}
