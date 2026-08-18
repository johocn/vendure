import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { InventoryService } from './inventory.service';

/**
 * 多库库存展示 Shop API：
 * 返回某商品在「各仓库/门店」的逐仓可售库存 + 与下单定位的距离，按距离升序。
 */
@Resolver()
export class InventoryShopResolver {
    constructor(private inventoryService: InventoryService) {}

    @Query()
    @Allow(Permission.Public)
    async variantNearbyStock(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'productId', type: () => String }) productId: ID,
        @Args({ name: 'variantId', type: () => String, nullable: true }) variantId?: ID,
        @Args({ name: 'lat', type: () => Number, nullable: true }) lat?: number,
        @Args({ name: 'lng', type: () => Number, nullable: true }) lng?: number,
        @Args({ name: 'city', type: () => String, nullable: true }) city?: string,
    ): Promise<any[]> {
        const rows = await this.inventoryService.findNearbyStock(ctx, {
            productId,
            variantId,
            lat,
            lng,
            city,
        });
        return rows.map(r => ({
            distanceKm: r.distanceKm,
            location: {
                id: r.location.id,
                name: r.location.name,
                description: r.location.description,
                lat: (r.location.customFields as any)?.lat ?? null,
                lng: (r.location.customFields as any)?.lng ?? null,
                serviceCities: (r.location.customFields as any)?.serviceCities ?? null,
            },
            variants: r.variants,
        }));
    }
}