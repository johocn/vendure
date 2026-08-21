import { Administrator, ID, RequestContext } from '@vendure/core';
import { Shop } from './shop.entity';
import { ShopService } from './shop.service';
import { CreateOwnerInput, MerchantOrder, MerchantReview, ShopListOptions, UpdateMyShopInput, UpdateMyShopProductInput } from './types';
/**
 * 店主自营后台（ADMIN API）。全部能力 @Allow(manageOwnShop.Permission) 把关「店主管理员」，
 * 归属隔离（Shop.administratorId / Product.shopId）由 service 层二次把关。
 * provisionShopOwner 为平台侧能力（UpdateSettings）。
 */
export declare class MerchantResolver {
    private shopService;
    constructor(shopService: ShopService);
    myShop(ctx: RequestContext): Promise<Shop>;
    myShopProducts(ctx: RequestContext, options: ShopListOptions): Promise<any>;
    myShopOrders(ctx: RequestContext): Promise<MerchantOrder[]>;
    myShopOrder(ctx: RequestContext, orderId: ID): Promise<MerchantOrder | undefined>;
    myShopReviews(ctx: RequestContext): Promise<MerchantReview[]>;
    provisionShopOwner(ctx: RequestContext, shopId: ID, input: CreateOwnerInput): Promise<Administrator>;
    updateMyShop(ctx: RequestContext, input: UpdateMyShopInput): Promise<Shop>;
    addProductToMyShop(ctx: RequestContext, productId: ID): Promise<boolean>;
    removeProductFromMyShop(ctx: RequestContext, productId: ID): Promise<boolean>;
    updateMyShopProduct(ctx: RequestContext, productId: ID, input: UpdateMyShopProductInput): Promise<any>;
    approveMerchantReview(ctx: RequestContext, id: ID): Promise<boolean>;
    rejectMerchantReview(ctx: RequestContext, id: ID): Promise<boolean>;
}
