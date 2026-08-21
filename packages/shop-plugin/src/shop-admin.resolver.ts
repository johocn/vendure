import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { Shop } from './shop.entity';
import { ShopService } from './shop.service';
import { ShopListOptions, ShopRating, ShopStatus } from './types';

@Resolver('Shop')
export class ShopAdminResolver {
    constructor(private shopService: ShopService) {}

    @Query()
    @Allow(Permission.ReadSettings)
    async shops(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: ShopListOptions,
    ): Promise<Shop[]> {
        return this.shopService.shops(ctx, options);
    }

    @Query()
    @Allow(Permission.ReadSettings)
    async shopById(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<Shop | undefined> {
        return this.shopService.getShop(ctx, id);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async createShop(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<Shop> {
        return this.shopService.createShop(ctx, input);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async updateShop(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('input') input: any,
    ): Promise<Shop> {
        return this.shopService.updateShop(ctx, id, input);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async setShopStatus(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('status') status: ShopStatus,
    ): Promise<Shop> {
        return this.shopService.setShopStatus(ctx, id, status);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async assignProductsToShop(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<boolean> {
        return this.shopService.assignProductsToShop(ctx, input);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async unassignProductsFromShop(
        @Ctx() ctx: RequestContext,
        @Args('input') input: any,
    ): Promise<boolean> {
        return this.shopService.unassignProductsFromShop(ctx, input);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async recomputeShopRating(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<Shop> {
        return this.shopService.recomputeShopRating(ctx, id);
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