import { RequestContext } from '@vendure/core';
import { MarketplaceSellerService } from '../marketplace-seller-service';
import { MarketplaceService } from '../marketplace.service';
import { CreateSellerInput } from '../types';
export declare class ShopResolver {
    private marketplaceSellerService;
    private marketplaceService;
    constructor(marketplaceSellerService: MarketplaceSellerService, marketplaceService: MarketplaceService);
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
    marketplaceProducts(ctx: RequestContext): Promise<{
        id: import("@vendure/core").ID;
        name: import("@vendure/core").LocaleString;
        slug: import("@vendure/core").LocaleString;
        barcode: string | null;
        internalCode: string | null;
        merchantChannel: {
            id: any;
            code: any;
            name: any;
        } | null;
    }[]>;
}
