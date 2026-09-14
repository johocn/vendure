import { ID, RequestContext } from '@vendure/core';
import { VirtualPhysicalStockService } from './virtual-physical-stock.service';
export declare class InventoryShopResolver {
    private virtualPhysicalStockService;
    constructor(virtualPhysicalStockService: VirtualPhysicalStockService);
    variantStockInfo(ctx: RequestContext, variantId: ID, lat?: number, lng?: number): Promise<{
        variantId: ID;
        saleableStock: number;
        physicalStockEnabled: boolean;
        stockDetail: any[];
    }>;
}
