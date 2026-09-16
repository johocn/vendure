import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';
import { VirtualPhysicalStockService } from './virtual-physical-stock.service';

@Resolver()
export class InventoryShopResolver {
    constructor(private virtualPhysicalStockService: VirtualPhysicalStockService) {}

    @Query()
    @Allow(Permission.Public)
    async variantStockInfo(
        @Ctx() ctx: RequestContext,
        @Args('variantId') variantId: ID,
        @Args('lat', { nullable: true }) lat?: number,
        @Args('lng', { nullable: true }) lng?: number,
        @Args('city', { nullable: true }) city?: string,
    ) {
        return this.virtualPhysicalStockService.getSaleableAndDetail(ctx, variantId, lat, lng, city);
    }
}
