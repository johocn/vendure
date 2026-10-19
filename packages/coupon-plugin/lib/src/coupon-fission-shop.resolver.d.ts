import { RequestContext } from '@vendure/core';
import { CouponTemplate } from './coupon-template.entity';
import { CouponFissionView } from './coupon-fission';
import { CouponFissionService } from './coupon-fission.service';
import { CustomerCoupon } from './customer-coupon.entity';
/** FR-C 分享裂变：C 端活动视图 + 领奖入口（匿名可看活动，领奖需登录——未登录返回 NOT_LOGGED_IN 由前端引导）。 */
export declare class CouponFissionShopResolver {
    private fissionService;
    constructor(fissionService: CouponFissionService);
    couponFissionActivity(ctx: RequestContext): Promise<CouponFissionView<CouponTemplate> | null>;
    claimFissionReward(ctx: RequestContext, inviteCode: string): Promise<{
        status: string;
        inviteeCoupon: CustomerCoupon | null;
        inviterCoupon: CustomerCoupon | null;
    }>;
}
