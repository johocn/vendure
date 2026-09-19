import { RequestContext } from '@vendure/core';

export type InventoryAdapterMode = 'simple' | 'odoo';

/** 变体在某仓的库存快照 */
export interface StockSnapshot {
    variantId: number;
    locationId: number;
    onHand: number;
    costPrice?: number | null;
}

/**
 * 库存来源适配器抽象：
 * 按 inventoryMode 选择实现（simple=本地 stockLevel / odoo=后续对接 Odoo）。
 */
export interface InventoryAdapter {
    mode: InventoryAdapterMode;
    fetchStock(ctx: RequestContext, variantId: number, locationId?: number): Promise<StockSnapshot[]>;
    fetchCost(ctx: RequestContext, variantId: number, locationId?: number): Promise<number | null>;
}