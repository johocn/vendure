import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext } from '@vendure/core';
import { manageOwnShop } from '@vendure/shop-plugin';

import { InventoryService } from './inventory.service';

/**
 * 店主自营库存（ADMIN API，阶段47）。全部 @Allow(manageOwnShop) 把关「店主管理员」，
 * 归属隔离（Shop.administratorId / Product.customFields.shopId）由 service 层二次把关。
 * 复用 shop-plugin 的 manageOwnShop 权限定义，与店主店铺/结算同权。
 */
@Resolver()
export class InventoryMerchantResolver {
    constructor(private inventoryService: InventoryService) {}

    @Query()
    @Allow(manageOwnShop.Permission)
    async myShopStock(
        @Ctx() ctx: RequestContext,
        @Args('productId') productId: ID,
    ): Promise<Array<{ variantId: ID; variantName: string | null; sku: string | null; locations: any[] }>> {
        return this.inventoryService.getMyShopStock(ctx, productId);
    }

    @Mutation()
    @Allow(manageOwnShop.Permission)
    async myShopStockAdjust(
        @Ctx() ctx: RequestContext,
        @Args('variantId') variantId: ID,
        @Args('stockLocationId') stockLocationId: ID,
        @Args('stockOnHand') stockOnHand: number,
    ): Promise<boolean> {
        return this.inventoryService.adjustMyShopStock(ctx, variantId, stockLocationId, stockOnHand);
    }
}