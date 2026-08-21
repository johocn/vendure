import { CustomerService, ID, Product, RequestContext, TransactionalConnection } from '@vendure/core';
export declare class FavoriteService {
    private connection;
    private customerService;
    constructor(connection: TransactionalConnection, customerService: CustomerService);
    /** 当前登录顾客；未登录抛 Unauthorized，无顾客记录抛 NotFound（对齐 review 口径）。 */
    private requireCustomer;
    /** toggle 收藏商品：返回收藏后的状态（true=已收藏）。 */
    toggleProductFavorite(ctx: RequestContext, productId: ID): Promise<boolean>;
    /** 商品是否已被当前顾客收藏。 */
    isProductFavorite(ctx: RequestContext, productId: ID): Promise<boolean>;
    /** 当前顾客收藏的商品列表。 */
    myFavoriteProducts(ctx: RequestContext): Promise<Product[]>;
    private recomputeProductFavoriteCount;
    /** toggle 关注店铺：返回关注后的状态（true=已关注）。 */
    toggleShopFollow(ctx: RequestContext, shopId: ID): Promise<boolean>;
    /** 店铺是否已被当前顾客关注。 */
    isShopFollowed(ctx: RequestContext, shopId: ID): Promise<boolean>;
    /** 当前顾客关注的店铺列表（shop-plugin 实体）。 */
    myFollowedShops(ctx: RequestContext): Promise<any[]>;
    /** 关注数（动态聚合，作为店铺热度展示口径；不落 shop-plugin 缓存列）。 */
    shopFollowerCount(ctx: RequestContext, shopId: ID): Promise<number>;
}
