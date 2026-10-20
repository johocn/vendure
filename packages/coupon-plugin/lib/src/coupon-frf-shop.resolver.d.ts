import { ID, RequestContext } from '@vendure/core';
import { CouponFrFService, DailyClaimActivityView, FlashSaleActivityView, FrfClaimResult } from './coupon-frf.service';
/**
 * FR-F：每日领券 / 神券日限量抢 C 端入口。
 * 活动视图匿名可查（未配置/未启用返回 null，前端不渲染）；
 * 领取需登录（未登录返回 NOT_LOGGED_IN，由前端引导）。
 */
export declare class CouponFrFShopResolver {
    private frfService;
    constructor(frfService: CouponFrFService);
    couponDailyClaimActivity(ctx: RequestContext): Promise<DailyClaimActivityView | null>;
    claimDailyCoupon(ctx: RequestContext, templateId: ID): Promise<FrfClaimResult>;
    couponFlashSaleActivity(ctx: RequestContext): Promise<FlashSaleActivityView | null>;
    claimFlashCoupon(ctx: RequestContext, templateId: ID): Promise<FrfClaimResult>;
}
