import { ID, ListQueryOptions, RequestContext } from '@vendure/core';
import { CouponService } from './coupon.service';
import { CouponTemplate } from './coupon-template.entity';
import { CustomerCoupon } from './customer-coupon.entity';
export declare class CouponAdminResolver {
    private couponService;
    constructor(couponService: CouponService);
    couponTemplates(ctx: RequestContext, options: ListQueryOptions<CouponTemplate>): Promise<{
        items: CouponTemplate[];
        totalItems: number;
    }>;
    couponTemplate(ctx: RequestContext, id: ID): Promise<CouponTemplate | undefined>;
    customerCoupons(ctx: RequestContext, options: ListQueryOptions<CustomerCoupon>): Promise<{
        items: CustomerCoupon[];
        totalItems: number;
    }>;
    createCouponTemplate(ctx: RequestContext, input: any): Promise<CouponTemplate>;
    updateCouponTemplate(ctx: RequestContext, input: any): Promise<CouponTemplate>;
    deleteCouponTemplate(ctx: RequestContext, id: ID): Promise<boolean>;
    grantCoupon(ctx: RequestContext, templateId: ID, customerIds: ID[]): Promise<string[]>;
    revokeCustomerCoupon(ctx: RequestContext, id: ID): Promise<CustomerCoupon>;
}
