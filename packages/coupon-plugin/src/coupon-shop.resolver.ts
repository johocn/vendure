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
    @Allow(Permission.Public)
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

    /**
     * 绑定券码到订单（Promotion 桥接入口）。
     * 设置 order.customFields.appliedCouponCode，由 couponOrderAction 自动计算折扣。
     * 不立即核销——核销由 OrderPlacedEvent 触发。
     */
    @Mutation()
    @Allow(Permission.Authenticated)
    async applyCoupon(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('code') code: string,
    ): Promise<CouponValidationResult> {
        return this.couponService.applyCouponToOrder(ctx, orderId, code);
    }

    /**
     * 移除订单上绑定的优惠券。
     * 清除 customFields.appliedCouponCode 并触发价格重新计算。
     */
    @Mutation()
    @Allow(Permission.Authenticated)
    async removeCoupon(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
    ): Promise<boolean> {
        await this.couponService.removeCouponFromOrder(ctx, orderId);
        return true;
    }
}
