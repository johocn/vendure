import { CustomerService, RequestContext } from '@vendure/core';
import { DataSource } from 'typeorm';
export interface FavoriteVariant {
    variantId: string;
    channelId: string;
}
/**
 * 商家收藏（C 端常用功能）。
 * 店铺 = 渠道，收藏记录落独立表 campus_favorite_shop（customerId + channelId 唯一），
 * 因此不受当前 activeChannel 影响：在店铺渠道内点收藏、回默认渠道读列表都能用。
 * 接口均为登录态；未登录返回 NOT_LOGGED_IN，前端游客态走本地存储。
 */
export declare class FavoriteShopResolver {
    private customerService;
    private dataSource;
    constructor(customerService: CustomerService, dataSource: DataSource);
    campusFavoriteStores(ctx: RequestContext): Promise<string[]>;
    campusToggleFavoriteStore(ctx: RequestContext, channelId: string): Promise<string[]>;
    /** Customer 无 userId 标量，按 user 关系反查（不过滤渠道，避免店铺渠道内收藏失败） */
    private requireCustomerId;
    campusFavoriteVariants(ctx: RequestContext): Promise<FavoriteVariant[]>;
    campusToggleFavoriteVariant(ctx: RequestContext, variantId: string, channelId: string): Promise<FavoriteVariant[]>;
}
