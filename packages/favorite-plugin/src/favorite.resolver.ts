import { Args, Query, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { FavoriteService } from './favorite.service';

@Resolver()
export class FavoriteShopResolver {
    constructor(private favoriteService: FavoriteService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myFavoriteProducts(@Ctx() ctx: RequestContext): Promise<any[]> {
        return this.favoriteService.myFavoriteProducts(ctx);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myFollowedShops(@Ctx() ctx: RequestContext): Promise<any[]> {
        return this.favoriteService.myFollowedShops(ctx);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async isProductFavorite(
        @Ctx() ctx: RequestContext,
        @Args('productId') productId: string,
    ): Promise<boolean> {
        return this.favoriteService.isProductFavorite(ctx, productId);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async isShopFollowed(
        @Ctx() ctx: RequestContext,
        @Args('shopId') shopId: string,
    ): Promise<boolean> {
        return this.favoriteService.isShopFollowed(ctx, shopId);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async shopFollowerCount(
        @Ctx() ctx: RequestContext,
        @Args('shopId') shopId: string,
    ): Promise<number> {
        return this.favoriteService.shopFollowerCount(ctx, shopId);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async toggleFavoriteProduct(
        @Ctx() ctx: RequestContext,
        @Args('productId') productId: string,
    ): Promise<boolean> {
        return this.favoriteService.toggleProductFavorite(ctx, productId);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async toggleFollowShop(
        @Ctx() ctx: RequestContext,
        @Args('shopId') shopId: string,
    ): Promise<boolean> {
        return this.favoriteService.toggleShopFollow(ctx, shopId);
    }
}