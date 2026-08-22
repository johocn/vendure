import { ID, RequestContext } from '@vendure/core';
import { InventoryService } from './inventory.service';
/**
 * 店主自营库存（ADMIN API，阶段47）。全部 @Allow(manageOwnShop) 把关「店主管理员」，
 * 归属隔离（Shop.administratorId / Product.customFields.shopId）由 service 层二次把关。
 * 复用 shop-plugin 的 manageOwnShop 权限定义，与店主店铺/结算同权。
 */
export declare class InventoryMerchantResolver {
    private inventoryService;
    constructor(inventoryService: InventoryService);
    myShopStock(ctx: RequestContext, productId: ID): Promise<Array<{
        variantId: ID;
        variantName: string | null;
        sku: string | null;
        locations: any[];
    }>>;
    myShopStockAdjust(ctx: RequestContext, variantId: ID, stockLocationId: ID, stockOnHand: number): Promise<boolean>;
}
