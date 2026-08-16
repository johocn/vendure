import { RequestContext } from '@vendure/core';
import { MarketplaceSellerService } from '../marketplace-seller-service';
import { CreateSellerInput } from '../types';
export declare class ShopResolver {
    private marketplaceSellerService;
    constructor(marketplaceSellerService: MarketplaceSellerService);
    registerMarketplaceSeller(ctx: RequestContext, args: {
        input: {
            shopName: string;
            seller: CreateSellerInput;
        };
    }): Promise<{
        id: import("@vendure/core").ID;
        code: string;
        token: string;
        errorCode?: undefined;
        message?: undefined;
    } | {
        errorCode: string;
        message: string;
        id?: undefined;
        code?: undefined;
        token?: undefined;
    }>;
}
