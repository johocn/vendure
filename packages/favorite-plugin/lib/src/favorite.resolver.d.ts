import { RequestContext } from '@vendure/core';
import { FavoriteService } from './favorite.service';
export declare class FavoriteShopResolver {
    private favoriteService;
    constructor(favoriteService: FavoriteService);
    myFavoriteProducts(ctx: RequestContext): Promise<any[]>;
    myFollowedShops(ctx: RequestContext): Promise<any[]>;
    isProductFavorite(ctx: RequestContext, productId: string): Promise<boolean>;
    isShopFollowed(ctx: RequestContext, shopId: string): Promise<boolean>;
    shopFollowerCount(ctx: RequestContext, shopId: string): Promise<number>;
    toggleFavoriteProduct(ctx: RequestContext, productId: string): Promise<boolean>;
    toggleFollowShop(ctx: RequestContext, shopId: string): Promise<boolean>;
}
