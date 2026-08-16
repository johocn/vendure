import { AvailableStock, ID, Injector, LocationWithQuantity, OrderLine, RequestContext, StockLevel, StockLocation, StockLocationStrategy } from '@vendure/core';
/**
 * @description
 * 独立的库存策略：根据订单行的销售来源（Order.customFields.saleSource）决定库存操作
 * 使用哪个 StockLocation。
 *
 * 每个 marketplace 商家需预置两个 StockLocation：
 * - `<商家>-marketplace`：marketplace 销售使用
 * - `<商家>-store`：商家自营销售使用
 *
 * 对于所有库存操作（分配/释放/销售/取消），先判断该 OrderLine 所属订单是否为
 * marketplace 销售，再按对应后缀筛选目标 StockLocation。
 */
export declare class MarketplaceStockLocationStrategy implements StockLocationStrategy {
    private entityHydrator;
    init(injector: Injector): void;
    getAvailableStock(ctx: RequestContext, productVariantId: ID, stockLevels: StockLevel[]): AvailableStock | Promise<AvailableStock>;
    forAllocation(ctx: RequestContext, stockLocations: StockLocation[], orderLine: OrderLine, quantity: number): Promise<LocationWithQuantity[]>;
    forRelease(ctx: RequestContext, stockLocations: StockLocation[], orderLine: OrderLine, quantity: number): Promise<LocationWithQuantity[]>;
    forSale(ctx: RequestContext, stockLocations: StockLocation[], orderLine: OrderLine, quantity: number): Promise<LocationWithQuantity[]>;
    forCancellation(ctx: RequestContext, stockLocations: StockLocation[], orderLine: OrderLine, quantity: number): Promise<LocationWithQuantity[]>;
    private getLocationForLine;
    private isMarketplaceSale;
}
