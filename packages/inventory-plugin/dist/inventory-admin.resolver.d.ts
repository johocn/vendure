import { ID, RequestContext } from '@vendure/core';
import { InventoryService } from './inventory.service';
export declare class InventoryAdminResolver {
    private inventoryService;
    constructor(inventoryService: InventoryService);
    stockLevels(ctx: RequestContext, locationId?: ID, page?: number, pageSize?: number): Promise<{
        items: import("@vendure/core").StockLevel[];
        totalItems: number;
    }>;
    setVariantStock(ctx: RequestContext, productVariantId: ID, stockLocationId: ID, stockOnHand: number): Promise<boolean>;
    stockMovements(ctx: RequestContext, productVariantId?: ID, locationId?: ID, type?: string, page?: number, pageSize?: number): Promise<{
        items: any[];
        totalItems: number;
    }>;
    stockLedger(ctx: RequestContext, productVariantId?: ID, locationId?: ID, bizType?: string, bizCode?: string, orderLineId?: ID, page?: number, pageSize?: number): Promise<{
        items: any[];
        totalItems: number;
    }>;
    stockInOrders(ctx: RequestContext, state?: string, page?: number, pageSize?: number): Promise<{
        items: import(".").StockInOrder[];
        totalItems: number;
    }>;
    stockInOrder(ctx: RequestContext, id: ID): Promise<import(".").StockInOrder | null>;
    createStockInOrder(ctx: RequestContext, input: any): Promise<import(".").StockInOrder>;
    completeStockInOrder(ctx: RequestContext, id: ID): Promise<import(".").StockInOrder>;
    cancelStockInOrder(ctx: RequestContext, id: ID): Promise<import(".").StockInOrder>;
    stockOutOrders(ctx: RequestContext, state?: string, page?: number, pageSize?: number): Promise<{
        items: import(".").StockOutOrder[];
        totalItems: number;
    }>;
    stockOutOrder(ctx: RequestContext, id: ID): Promise<import(".").StockOutOrder | null>;
    createStockOutOrder(ctx: RequestContext, input: any): Promise<import(".").StockOutOrder>;
    completeStockOutOrder(ctx: RequestContext, id: ID): Promise<import(".").StockOutOrder>;
    cancelStockOutOrder(ctx: RequestContext, id: ID): Promise<import(".").StockOutOrder>;
    stockMoveOrders(ctx: RequestContext, state?: string, page?: number, pageSize?: number): Promise<{
        items: import(".").StockMoveOrder[];
        totalItems: number;
    }>;
    stockMoveOrder(ctx: RequestContext, id: ID): Promise<import(".").StockMoveOrder | null>;
    createStockMoveOrder(ctx: RequestContext, input: any): Promise<import(".").StockMoveOrder>;
    shipStockMoveOrder(ctx: RequestContext, id: ID): Promise<import(".").StockMoveOrder>;
    receiveStockMoveOrder(ctx: RequestContext, id: ID): Promise<import(".").StockMoveOrder>;
    completeStockMoveOrder(ctx: RequestContext, id: ID): Promise<import(".").StockMoveOrder>;
    cancelStockMoveOrder(ctx: RequestContext, id: ID): Promise<import(".").StockMoveOrder>;
    stocktakeOrders(ctx: RequestContext, state?: string, page?: number, pageSize?: number): Promise<{
        items: import(".").StocktakeOrder[];
        totalItems: number;
    }>;
    stocktakeOrder(ctx: RequestContext, id: ID): Promise<import(".").StocktakeOrder | null>;
    createStocktakeOrder(ctx: RequestContext, input: any): Promise<import(".").StocktakeOrder>;
    startCountingStocktake(ctx: RequestContext, id: ID): Promise<import(".").StocktakeOrder>;
    submitStocktakeCount(ctx: RequestContext, id: ID, counts: any[]): Promise<import(".").StocktakeOrder>;
    reconcileStocktakeLine(ctx: RequestContext, orderId: ID, lineId: ID): Promise<import(".").StocktakeOrder>;
    completeStocktakeOrder(ctx: RequestContext, id: ID): Promise<import(".").StocktakeOrder>;
    cancelStocktakeOrder(ctx: RequestContext, id: ID): Promise<import(".").StocktakeOrder>;
}
