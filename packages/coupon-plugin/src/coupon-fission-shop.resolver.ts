import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';

import { CouponTemplate } from './coupon-template.entity';
import { CouponFissionView } from './coupon-fission';
import { CouponFissionService } from './coupon-fission.service';
import { CustomerCoupon } from './customer-coupon.entity';

/** FR-C 分享裂变：C 端活动视图 + 领奖入口（匿名可看活动，领奖需登录——未登录返回 NOT_LOGGED_IN 由前端引导）。 */
@Resolver()
export class CouponFissionShopResolver {
    constructor(private fissionService: CouponFissionService) {}

    @Query()
    async couponFissionActivity(@Ctx() ctx: RequestContext): Promise<CouponFissionView<CouponTemplate> | null> {
        return this.fissionService.fissionActivity(ctx);
    }

    @Mutation()
    claimFissionReward(
        @Ctx() ctx: RequestContext,
        @Args('inviteCode') inviteCode: string,
    ): Promise<{ status: string; inviteeCoupon: CustomerCoupon | null; inviterCoupon: CustomerCoupon | null }> {
        return this.fissionService.claimReward(ctx, inviteCode);
    }
}
