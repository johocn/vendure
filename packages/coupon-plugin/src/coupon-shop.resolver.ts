import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { CouponCode } from './coupon-code.entity';
import { Coupon } from './coupon.entity';
import { CouponService, CouponValidationResult } from './coupon.service';

@Resolver(() => CouponCode)
export class CouponShopResolver {
    constructor(private couponService: CouponService) {}

    @ResolveField('coupon', () => Coupon)
    async coupon(
        @Ctx() ctx: RequestContext,
        @Parent() couponCode: CouponCode,
    ): Promise<Coupon | null> {
        return this.couponService.getCoupon(ctx, couponCode.couponId);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async availableCoupons(@Ctx() ctx: RequestContext): Promise<Coupon[]> {
        return this.couponService.getAvailableCoupons(ctx);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myCoupons(
        @Ctx() ctx: RequestContext,
        @Args('status', { nullable: true }) status?: string,
    ): Promise<CouponCode[]> {
        return this.couponService.getMyCoupons(ctx, status);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async validateCoupon(
        @Ctx() ctx: RequestContext,
        @Args('code') code: string,
        @Args('orderId', { nullable: true }) orderId?: ID,
    ): Promise<CouponValidationResult> {
        if (!orderId) {
            return { valid: true, discountAmount: 0, error: null };
        }
        const orderLines = await this.couponService.getOrderLinesForCoupon(ctx, orderId);
        return this.couponService.validateCoupon(ctx, code, orderLines);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async claimCoupon(
        @Ctx() ctx: RequestContext,
        @Args('couponId') couponId: ID,
    ): Promise<CouponCode> {
        return this.couponService.claimCoupon(ctx, couponId);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async redeemCoupon(
        @Ctx() ctx: RequestContext,
        @Args('code') code: string,
        @Args('orderId') orderId: ID,
    ): Promise<CouponCode> {
        return this.couponService.redeemCoupon(ctx, code, orderId);
    }
}
