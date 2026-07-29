import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
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

@Resolver(() => Coupon)
export class CouponAdminResolver {
    constructor(private couponService: CouponService) {}

    @ResolveField('enabledInCurrentChannel', () => Boolean)
    async enabledInCurrentChannel(
        @Ctx() ctx: RequestContext,
        @Parent() coupon: Coupon,
    ): Promise<boolean> {
        // 如果是租户自建券，总是返回 true（自己渠道的券自然是启用的）
        if (!coupon.isGlobal) return true;
        // 全局券：检查 channels 关系中是否包含当前渠道
        const full = await this.couponService.getCoupon(ctx, coupon.id);
        if (!full || !full.channels) return false;
        return full.channels.some(ch => ch.id === ctx.channelId);
    }

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

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async enableCouponForChannel(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<Coupon> {
        return this.couponService.enableCouponForChannel(ctx, id);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async disableCouponForChannel(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<Coupon> {
        return this.couponService.disableCouponForChannel(ctx, id);
    }
}
