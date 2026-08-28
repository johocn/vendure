import { RequestContext, TransactionalConnection } from '@vendure/core';
import { MarketplaceSellerService } from '../marketplace-seller-service';
import { MarketplaceService } from '../marketplace.service';
import { CreateSellerInput } from '../types';
export declare class ShopResolver {
    private marketplaceSellerService;
    private marketplaceService;
    private connection;
    constructor(marketplaceSellerService: MarketplaceSellerService, marketplaceService: MarketplaceService, connection: TransactionalConnection);
    registerMarketplaceSeller(ctx: RequestContext, args: {
        input: {
            shopName: string;
            seller: CreateSellerInput;
        };
    }): Promise<{
        __typename: string;
        id: import("@vendure/core").ID;
        code: string;
        token: string;
        errorCode?: undefined;
        message?: undefined;
    } | {
        __typename: string;
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
    submitForMarketplace(ctx: RequestContext, args: {
        productId: string;
    }): Promise<boolean>;
    myMerchantProducts(ctx: RequestContext): Promise<{
        id: import("@vendure/core").ID;
        name: import("@vendure/core").LocaleString;
        slug: import("@vendure/core").LocaleString;
        barcode: string | null;
        internalCode: string | null;
        marketplaceStatus: string;
        rejectReason: string | null;
        listedInMarketplace: boolean;
    }[]>;
    marketplacePendingProducts(ctx: RequestContext): Promise<{
        id: import("@vendure/core").ID;
        name: import("@vendure/core").LocaleString;
        slug: import("@vendure/core").LocaleString;
        barcode: string | null;
        internalCode: string | null;
        marketplaceStatus: string;
        rejectReason: string | null;
        listedInMarketplace: boolean;
    }[]>;
    marketplaceApprove(ctx: RequestContext, args: {
        productId: string;
    }): Promise<boolean>;
    marketplaceReject(ctx: RequestContext, args: {
        productId: string;
        reason: string;
    }): Promise<boolean>;
}
