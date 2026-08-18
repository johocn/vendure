import { ID, RequestContext } from '@vendure/core';
import { InventoryService } from './inventory.service';
/**
 * 多库库存展示 Shop API：
 * 返回某商品在「各仓库/门店」的逐仓可售库存 + 与下单定位的距离，按距离升序。
 */
export declare class InventoryShopResolver {
    private inventoryService;
    constructor(inventoryService: InventoryService);
    variantNearbyStock(ctx: RequestContext, productId: ID, variantId?: ID, lat?: number, lng?: number, city?: string): Promise<any[]>;
}
