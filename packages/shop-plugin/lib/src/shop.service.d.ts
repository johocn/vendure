import { ID, PaginatedList, Product, ProductService, RequestContext, TransactionalConnection } from '@vendure/core';
import { Shop } from './shop.entity';
import { AssignProductsInput, CreateShopInput, ShopListOptions, ShopRating, ShopStatus, UpdateShopInput } from './types';
export declare class ShopService {
    private connection;
    private productService;
    constructor(connection: TransactionalConnection, productService: ProductService);
    createShop(ctx: RequestContext, input: CreateShopInput): Promise<Shop>;
    updateShop(ctx: RequestContext, id: ID, input: UpdateShopInput): Promise<Shop>;
    setShopStatus(ctx: RequestContext, id: ID, status: ShopStatus): Promise<Shop>;
    assignProductsToShop(ctx: RequestContext, input: AssignProductsInput): Promise<boolean>;
    unassignProductsFromShop(ctx: RequestContext, input: AssignProductsInput): Promise<boolean>;
    /** 管理端列表（全部状态）。 */
    shops(ctx: RequestContext, options?: ShopListOptions): Promise<Shop[]>;
    getShop(ctx: RequestContext, id: ID): Promise<Shop>;
    /** C 端列表：仅 active 店铺。 */
    getActiveShops(ctx: RequestContext, options?: ShopListOptions): Promise<Shop[]>;
    /** C 端店铺主页：仅 active 对外；slug 不存在或非 active 返回 undefined（Query 返回 nullable）。 */
    getShopBySlug(ctx: RequestContext, slug: string): Promise<Shop | undefined>;
    /** 店铺商品分页列表：按 Product.customFields.shopId 过滤（marketplace 同款写法）。 */
    getShopProducts(ctx: RequestContext, shopId: ID, options?: ShopListOptions): Promise<PaginatedList<Product>>;
    /** 店铺评分（实时口径）：聚合归属商品的 reviewRating/reviewCount。始终正确。 */
    getShopRating(ctx: RequestContext, shopId: ID): Promise<ShopRating>;
    /** 重算店铺评分并写回 Shop 缓存列（列表/店铺页读取，避免 N+1）。 */
    recomputeShopRating(ctx: RequestContext, shopId: ID): Promise<Shop>;
    /** 读店铺缓存评分（供 ResolveField）；无缓存时回退实时计算。 */
    getShopRatingCachedOrCompute(ctx: RequestContext, shop: Shop): Promise<ShopRating>;
    private assertSlugUnique;
    private getEntityOrThrow;
}
