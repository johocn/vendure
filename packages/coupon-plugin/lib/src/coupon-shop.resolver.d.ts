import { ID, RequestContext } from '@vendure/core';
import { CouponCode } from './coupon-code.entity';
import { Coupon } from './coupon.entity';
import { CouponService, CouponValidationResult } from './coupon.service';
export declare class CouponShopResolver {
    private couponService;
    constructor(couponService: CouponService);
    coupon(ctx: RequestContext, couponCode: CouponCode): Promise<Coupon | null>;
    availableCoupons(ctx: RequestContext): Promise<Coupon[]>;
    myCoupons(ctx: RequestContext, status?: string): Promise<CouponCode[]>;
    validateCoupon(ctx: RequestContext, code: string, orderId?: ID): Promise<CouponValidationResult>;
    claimCoupon(ctx: RequestContext, couponId: ID): Promise<CouponCode>;
    redeemCoupon(ctx: RequestContext, code: string, orderId: ID): Promise<CouponCode>;
    /**
     * 绑定券码到订单（Promotion 桥接入口）。
     * 设置 order.customFields.appliedCouponCode，由 couponOrderAction 自动计算折扣。
     * 不立即核销——核销由 OrderPlacedEvent 触发。
     */
    applyCoupon(ctx: RequestContext, orderId: ID, code: string): Promise<CouponValidationResult>;
}
