import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Administrator, Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { manageOwnShop } from './merchant-permissions';
import { Shop } from './shop.entity';
import { ShopService } from './shop.service';
import { CreateOwnerInput, MerchantOrder, MerchantReview, ShopListOptions, UpdateMyShopInput, UpdateMyShopProductInput } from './types';

/**
 * 店主自营后台（ADMIN API）。全部能力 @Allow(manageOwnShop.Permission) 把关「店主管理员」，
 * 归属隔离（Shop.administratorId / Product.shopId）由 service 层二次把关。
 * provisionShopOwner 为平台侧能力（UpdateSettings）。
 */
@Resolver()
export class MerchantResolver {
    constructor(private shopService: ShopService) {}

    @Query()
    @Allow(manageOwnShop.Permission)
    async myShop(@Ctx() ctx: RequestContext): Promise<Shop> {
        return this.shopService.requireMyShop(ctx);
    }

    @Query()
    @Allow(manageOwnShop.Permission)
    async myShopProducts(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: ShopListOptions,
    ): Promise<any> {
        return this.shopService.getMyShopProducts(ctx, options);
    }

    @Query()
    @Allow(manageOwnShop.Permission)
    async myShopOrders(@Ctx() ctx: RequestContext): Promise<MerchantOrder[]> {
        return this.shopService.getMyShopOrders(ctx);
    }

    @Query()
    @Allow(manageOwnShop.Permission)
    async myShopOrder(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID): Promise<MerchantOrder | undefined> {
        return this.shopService.getMyShopOrder(ctx, orderId);
    }

    @Query()
    @Allow(manageOwnShop.Permission)
    async myShopReviews(@Ctx() ctx: RequestContext): Promise<MerchantReview[]> {
        return this.shopService.getMyShopReviews(ctx);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async provisionShopOwner(
        @Ctx() ctx: RequestContext,
        @Args('shopId') shopId: ID,
        @Args('input') input: CreateOwnerInput,
    ): Promise<Administrator> {
        return this.shopService.provisionShopOwner(ctx, shopId, input);
    }

    @Mutation()
    @Allow(manageOwnShop.Permission)
    async updateMyShop(@Ctx() ctx: RequestContext, @Args('input') input: UpdateMyShopInput): Promise<Shop> {
        return this.shopService.updateMyShop(ctx, input);
    }

    @Mutation()
    @Allow(manageOwnShop.Permission)
    async addProductToMyShop(@Ctx() ctx: RequestContext, @Args('productId') productId: ID): Promise<boolean> {
        return this.shopService.addProductToMyShop(ctx, productId);
    }

    @Mutation()
    @Allow(manageOwnShop.Permission)
    async removeProductFromMyShop(@Ctx() ctx: RequestContext, @Args('productId') productId: ID): Promise<boolean> {
        return this.shopService.removeProductFromMyShop(ctx, productId);
    }

    @Mutation()
    @Allow(manageOwnShop.Permission)
    async updateMyShopProduct(
        @Ctx() ctx: RequestContext,
        @Args('productId') productId: ID,
        @Args('input') input: UpdateMyShopProductInput,
    ): Promise<any> {
        return this.shopService.updateMyShopProduct(ctx, productId, input);
    }

    @Mutation()
    @Allow(manageOwnShop.Permission)
    async approveMerchantReview(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.shopService.approveMerchantReview(ctx, id);
    }

    @Mutation()
    @Allow(manageOwnShop.Permission)
    async rejectMerchantReview(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.shopService.rejectMerchantReview(ctx, id);
    }
}