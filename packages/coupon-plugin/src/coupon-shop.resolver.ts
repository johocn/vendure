import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, OrderService, RequestContext, Transaction, UserInputError } from '@vendure/core';

import { CouponService } from './coupon.service';

@Resolver()
export class CouponShopResolver {
    constructor(
        private couponService: CouponService,
        private orderService: OrderService,
    ) {}

    @Query()
    async couponCentre(@Ctx() ctx: RequestContext) {
        return this.couponService.couponCentre(ctx);
    }

    @Query()
    async myCoupons(@Ctx() ctx: RequestContext, @Args('status') status?: string) {
        return this.couponService.listMyCoupons(ctx, status);
    }

    @Query()
    async pointsMallTemplates(@Ctx() ctx: RequestContext) {
        return this.couponService.pointsMallTemplates(ctx);
    }

    @Mutation()
    @Transaction()
    async claimCoupon(@Ctx() ctx: RequestContext, @Args('templateId') templateId: ID) {
        return this.couponService.claimCoupon(ctx, templateId);
    }

    @Mutation()
    @Transaction()
    async applyCouponToOrder(@Ctx() ctx: RequestContext, @Args('code') code: string) {
        const order = await this.orderService.getActiveOrderForUser(ctx, ctx.activeUserId!);
        if (!order) {
            throw new UserInputError('No active order to apply coupon');
        }
        return this.couponService.applyCouponToOrder(ctx, order.id, code);
    }

    @Mutation()
    @Transaction()
    async clearCouponFromOrder(@Ctx() ctx: RequestContext) {
        const order = await this.orderService.getActiveOrderForUser(ctx, ctx.activeUserId!);
        if (!order) {
            throw new UserInputError('No active order to clear coupon');
        }
        return this.couponService.clearCouponFromOrder(ctx, order.id);
    }

    @Mutation()
    @Transaction()
    async exchangeCouponWithPoints(@Ctx() ctx: RequestContext, @Args('templateId') templateId: ID) {
        return this.couponService.exchangeWithPoints(ctx, templateId);
    }
}