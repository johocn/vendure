import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    ID,
    ListQueryOptions,
    PaginatedList,
    Permission,
    RequestContext,
} from '@vendure/core';

import { Coupon } from './coupon.entity';
import { CouponService } from './coupon.service';

@Resolver()
export class CouponAdminResolver {
    constructor(private couponService: CouponService) {}

    @Query()
    @Allow(Permission.ReadSettings)
    async coupons(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<Coupon>,
    ): Promise<PaginatedList<Coupon>> {
        return this.couponService.getCoupons(ctx, options);
    }

    @Query()
    @Allow(Permission.ReadSettings)
    async coupon(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<Coupon | null> {
        return this.couponService.getCoupon(ctx, id);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async createCoupon(
        @Ctx() ctx: RequestContext,
        @Args('input') input: any,
    ): Promise<Coupon> {
        return this.couponService.createCoupon(ctx, input);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async updateCoupon(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('input') input: any,
    ): Promise<Coupon> {
        return this.couponService.updateCoupon(ctx, id, input);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async deleteCoupon(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.couponService.deleteCoupon(ctx, id);
    }
}
