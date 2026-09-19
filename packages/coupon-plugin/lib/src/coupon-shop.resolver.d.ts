import { ID, OrderService, RequestContext } from '@vendure/core';
import { CouponService } from './coupon.service';
export declare class CouponShopResolver {
    private couponService;
    private orderService;
    constructor(couponService: CouponService, orderService: OrderService);
    couponCentre(ctx: RequestContext): Promise<import("./coupon-template.entity").CouponTemplate[]>;
    myCoupons(ctx: RequestContext, status?: string): Promise<import("./customer-coupon.entity").CustomerCoupon[]>;
    pointsMallTemplates(ctx: RequestContext): Promise<import("./coupon-template.entity").CouponTemplate[]>;
    productCoupons(ctx: RequestContext, productId: ID): Promise<import("./product-coupon-binding.entity").ProductCouponBinding[]>;
    claimProductCoupon(ctx: RequestContext, bindingId: ID): Promise<import("./customer-coupon.entity").CustomerCoupon>;
    redeemCouponByCode(ctx: RequestContext, claimCode: string): Promise<import("./customer-coupon.entity").CustomerCoupon>;
    claimCoupon(ctx: RequestContext, templateId: ID): Promise<import("./customer-coupon.entity").CustomerCoupon>;
    applyCouponToOrder(ctx: RequestContext, code: string): Promise<any>;
    clearCouponFromOrder(ctx: RequestContext): Promise<any>;
    exchangeCouponWithPoints(ctx: RequestContext, templateId: ID): Promise<{
        coupon: import("./customer-coupon.entity").CustomerCoupon;
        spentPoints: number;
    }>;
}
