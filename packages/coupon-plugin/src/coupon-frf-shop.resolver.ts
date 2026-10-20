import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, RequestContext } from '@vendure/core';

import { CouponTemplate } from './coupon-template.entity';
import { CouponFrFService, DailyClaimActivityView, FlashSaleActivityView, FrfClaimResult } from './coupon-frf.service';
import { CustomerCoupon } from './customer-coupon.entity';

/**
 * FR-F：每日领券 / 神券日限量抢 C 端入口。
 * 活动视图匿名可查（未配置/未启用返回 null，前端不渲染）；
 * 领取需登录（未登录返回 NOT_LOGGED_IN，由前端引导）。
 */
@Resolver()
export class CouponFrFShopResolver {
    constructor(private frfService: CouponFrFService) {}

    @Query()
    async couponDailyClaimActivity(@Ctx() ctx: RequestContext): Promise<DailyClaimActivityView | null> {
        return this.frfService.dailyClaimActivity(ctx);
    }

    @Mutation()
    claimDailyCoupon(
        @Ctx() ctx: RequestContext,
        @Args('templateId') templateId: ID,
    ): Promise<FrfClaimResult> {
        return this.frfService.claimDaily(ctx, Number(templateId));
    }

    @Query()
    async couponFlashSaleActivity(@Ctx() ctx: RequestContext): Promise<FlashSaleActivityView | null> {
        return this.frfService.flashSaleActivity(ctx);
    }

    @Mutation()
    claimFlashCoupon(
        @Ctx() ctx: RequestContext,
        @Args('templateId') templateId: ID,
    ): Promise<FrfClaimResult> {
        return this.frfService.claimFlash(ctx, Number(templateId));
    }
}
