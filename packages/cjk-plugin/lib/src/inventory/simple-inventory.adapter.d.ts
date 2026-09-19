import { RequestContext, StockLevelService, TransactionalConnection } from '@vendure/core';
import { InventoryAdapter, InventoryAdapterMode, StockSnapshot } from './inventory-adapter';
/**
 * simple 模式适配器：直接读取本地 stockLevel（物理/虚拟仓 onHand），
 * costPrice 取近期的单据成本价（StockDocItemEntity 最新一条非空 costPrice）。
 */
export declare class SimpleInventoryAdapter implements InventoryAdapter {
    private stockLevelService;
    private conn;
    mode: InventoryAdapterMode;
    constructor(stockLevelService: StockLevelService, conn: TransactionalConnection);
    fetchStock(ctx: RequestContext, variantId: number, locationId?: number): Promise<StockSnapshot[]>;
    fetchCost(ctx: RequestContext, variantId: number, _locationId?: number): Promise<number | null>;
}
