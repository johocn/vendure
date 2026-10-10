import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, Transaction } from '@vendure/core';

import { PointsMallService } from './points-mall.service';
import {
    CreatePointsOrderInput,
    FavoriteProductView,
    PointsOrderListOptions,
    PointsPayParams,
    PointsProductListOptions,
    PointsProductView,
    ToggleFavoriteResult,
} from './types';

@Resolver()
export class PointsMallShopResolver {
    constructor(private pointsMallService: PointsMallService) {}

    /** 游客可浏览积分商城列表（对齐 usemall），不加 @Allow。 */
    @Query()
    async pointsProducts(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options?: PointsProductListOptions,
    ): Promise<{ items: PointsProductView[]; totalItems: number }> {
        return this.pointsMallService.shopPointsProducts(ctx, options);
    }

    /** 游客可看详情，不加 @Allow。 */
    @Query()
    async pointsProduct(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<PointsProductView | undefined> {
        return this.pointsMallService.shopPointsProduct(ctx, id);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myFavorites(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options?: PointsProductListOptions,
    ): Promise<{ items: FavoriteProductView[]; totalItems: number }> {
        return this.pointsMallService.myFavorites(ctx, options);
    }

    /** 游客可看收藏元信息（service 内部处理未登录），不加 @Allow。 */
    @Query()
    async productFavoriteMeta(
        @Ctx() ctx: RequestContext,
        @Args('productId') productId: ID,
    ): Promise<{ favoriteCount: number; myFavorited: boolean }> {
        return this.pointsMallService.favoriteMeta(ctx, productId);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myPointsOrders(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options?: PointsOrderListOptions,
    ) {
        return this.pointsMallService.myPointsOrders(ctx, options);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myPointsOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.pointsMallService.myPointsOrder(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async toggleProductFavorite(
        @Ctx() ctx: RequestContext,
        @Args('productId') productId: ID,
    ): Promise<ToggleFavoriteResult> {
        return this.pointsMallService.toggleProductFavorite(ctx, productId);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async createPointsOrderExchange(
        @Ctx() ctx: RequestContext,
        @Args('input') input: CreatePointsOrderInput,
    ) {
        return this.pointsMallService.createPointsOrderExchange(ctx, input);
    }

    /** 拉取外部微信支付接口，不在 DB 事务内。 */
    @Mutation()
    @Allow(Permission.Authenticated)
    async createPointsOrderPayment(
        @Ctx() ctx: RequestContext,
        @Args('pointsOrderId') pointsOrderId: ID,
        @Args('tradeType', { nullable: true }) tradeType?: string,
        @Args('openid', { nullable: true }) openid?: string,
    ): Promise<PointsPayParams> {
        return this.pointsMallService.createPointsOrderPayment(ctx, pointsOrderId, tradeType, openid);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async cancelPointsOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.pointsMallService.cancelPointsOrder(ctx, id);
    }
}
