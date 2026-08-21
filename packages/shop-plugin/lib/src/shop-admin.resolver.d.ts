import { ID, RequestContext } from '@vendure/core';
import { Shop } from './shop.entity';
import { ShopService } from './shop.service';
import { ShopListOptions, ShopRating, ShopStatus } from './types';
export declare class ShopAdminResolver {
    private shopService;
    constructor(shopService: ShopService);
    shops(ctx: RequestContext, options: ShopListOptions): Promise<Shop[]>;
    shopById(ctx: RequestContext, id: ID): Promise<Shop | undefined>;
    createShop(ctx: RequestContext, input: any): Promise<Shop>;
    updateShop(ctx: RequestContext, id: ID, input: any): Promise<Shop>;
    setShopStatus(ctx: RequestContext, id: ID, status: ShopStatus): Promise<Shop>;
    assignProductsToShop(ctx: RequestContext, input: any): Promise<boolean>;
    unassignProductsFromShop(ctx: RequestContext, input: any): Promise<boolean>;
    recomputeShopRating(ctx: RequestContext, id: ID): Promise<Shop>;
    rating(ctx: RequestContext, shop: Shop): Promise<ShopRating>;
    productCount(ctx: RequestContext, shop: Shop): Promise<number>;
    products(ctx: RequestContext, shop: Shop, options: ShopListOptions): Promise<any>;
}
