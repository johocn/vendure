import { RequestContext } from '@vendure/core';
import { Shop } from './shop.entity';
import { ShopService } from './shop.service';
import { ShopListOptions, ShopRating } from './types';
export declare class ShopShopResolver {
    private shopService;
    constructor(shopService: ShopService);
    shops(ctx: RequestContext, options: ShopListOptions): Promise<Shop[]>;
    shop(ctx: RequestContext, slug: string): Promise<Shop | undefined>;
    rating(ctx: RequestContext, shop: Shop): Promise<ShopRating>;
    productCount(ctx: RequestContext, shop: Shop): Promise<number>;
    products(ctx: RequestContext, shop: Shop, options: ShopListOptions): Promise<any>;
}
