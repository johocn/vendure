import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { Shop } from './shop.entity';
import { ShopService } from './shop.service';
import { ShopListOptions, ShopRating } from './types';

@Resolver('Shop')
export class ShopShopResolver {
    constructor(private shopService: ShopService) {}

    @Query()
    @Allow(Permission.Public)
    async shops(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: ShopListOptions,
    ): Promise<Shop[]> {
        return this.shopService.getActiveShops(ctx, options);
    }

    @Query()
    @Allow(Permission.Public)
    async shop(@Ctx() ctx: RequestContext, @Args('slug') slug: string): Promise<Shop | undefined> {
        return this.shopService.getShopBySlug(ctx, slug);
    }

    @ResolveField()
    async rating(@Ctx() ctx: RequestContext, @Parent() shop: Shop): Promise<ShopRating> {
        return this.shopService.getShopRatingCachedOrCompute(ctx, shop);
    }

    @ResolveField()
    async productCount(@Ctx() ctx: RequestContext, @Parent() shop: Shop): Promise<number> {
        const r = await this.shopService.getShopRatingCachedOrCompute(ctx, shop);
        return r.productCount;
    }

    @ResolveField()
    async products(
        @Ctx() ctx: RequestContext,
        @Parent() shop: Shop,
        @Args('options', { nullable: true }) options: ShopListOptions,
    ): Promise<any> {
        return this.shopService.getShopProducts(ctx, shop.id as number, options);
    }
}