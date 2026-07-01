import { RequestContext, StockAllocationStrategy } from '@vendure/core';
export declare class ChannelStockAllocationStrategy implements StockAllocationStrategy {
    shouldAllocateStock(): boolean | Promise<boolean>;
    allocateFromStockLocation(ctx: RequestContext, stockLocations: Array<{
        id: string;
        stockOnHand: number;
    }>, _item: any): Promise<any>;
}
