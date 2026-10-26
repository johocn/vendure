import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, Transaction, UserInputError } from '@vendure/core';

import { CouponStoreService } from './coupon-store.service';

/**
 * 券 ↔ 门店（shop-api）：
 * - couponTemplateStores：券模板可用门店（无绑定 = 附近全部门店，历史券不变）
 * - couponStoresForCoupon：按券码查本人券的可用门店
 * - redeemCouponAtStore：到店核销（需登录，本人券）
 */
@Resolver()
export class CouponStoreShopResolver {
    constructor(private couponStoreService: CouponStoreService) {}

    @Query()
    async couponTemplateStores(
        @Ctx() ctx: RequestContext,
        @Args('templateId') templateId: ID,
        @Args('lat', { nullable: true }) lat?: number,
        @Args('lng', { nullable: true }) lng?: number,
    ) {
        return this.couponStoreService.templateStores(ctx, templateId, lat ?? null, lng ?? null);
    }

    @Query()
    async couponStoresForCoupon(
        @Ctx() ctx: RequestContext,
        @Args('code') code: string,
        @Args('lat', { nullable: true }) lat?: number,
        @Args('lng', { nullable: true }) lng?: number,
    ) {
        return this.couponStoreService.storesForCoupon(ctx, code, lat ?? null, lng ?? null);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async redeemCouponAtStore(
        @Ctx() ctx: RequestContext,
        @Args('couponCode') couponCode: string,
        @Args('storeId') storeId: ID,
    ) {
        if (!ctx.activeUserId) {
            throw new UserInputError('Please sign in to redeem the coupon');
        }
        return this.couponStoreService.redeemAtStore(ctx, couponCode, storeId);
    }
}
