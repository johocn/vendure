import { RequestContext } from '@vendure/core';
import { MarketplaceProductService, MarketplaceProductView } from './marketplace-product.service';
export declare class MarketplaceProductResolver {
    private service;
    constructor(service: MarketplaceProductService);
    submitProductToMarketplace(ctx: RequestContext, id: string): Promise<MarketplaceProductView>;
    reviewMarketplaceProduct(ctx: RequestContext, id: string, approve: boolean, rejectReason?: string | null): Promise<MarketplaceProductView>;
    marketplaceProducts(ctx: RequestContext, status?: string | null): Promise<MarketplaceProductView[]>;
}
