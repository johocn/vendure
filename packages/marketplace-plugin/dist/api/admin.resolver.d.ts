import { RequestContext } from '@vendure/core';
import { MarketplaceService } from '../marketplace.service';
export declare class AdminMarketplaceResolver {
    private marketplaceService;
    constructor(marketplaceService: MarketplaceService);
    approveMarketplaceProduct(ctx: RequestContext, args: {
        productId: string;
    }): Promise<boolean>;
    rejectMarketplaceProduct(ctx: RequestContext, args: {
        productId: string;
        reason: string;
    }): Promise<boolean>;
    marketplacePendingProducts(ctx: RequestContext): Promise<any>;
}
