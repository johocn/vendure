import { OrderListOptions } from '@vendure/common/lib/generated-types';
import { Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { MarketplaceService } from '../marketplace.service';
export declare class AdminMarketplaceResolver {
    private marketplaceService;
    private connection;
    constructor(marketplaceService: MarketplaceService, connection: TransactionalConnection);
    approveMarketplaceProduct(ctx: RequestContext, args: {
        productId: string;
    }): Promise<boolean>;
    rejectMarketplaceProduct(ctx: RequestContext, args: {
        productId: string;
        reason: string;
    }): Promise<boolean>;
    submitForMarketplaceAdmin(ctx: RequestContext, args: {
        productId: string;
    }): Promise<boolean>;
    marketplacePendingProducts(ctx: RequestContext): Promise<any>;
    marketplaceMerchantChannel(ctx: RequestContext): import("@vendure/core").Channel;
    merchantOrders(ctx: RequestContext, args: {
        saleSource?: string;
        options?: OrderListOptions;
    }): Promise<{
        items: Order[];
        totalItems: number;
    }>;
}
