import { ID, ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { Coupon } from './coupon.entity';
import { CouponService } from './coupon.service';
export declare class CouponAdminResolver {
    private couponService;
    constructor(couponService: CouponService);
    coupons(ctx: RequestContext, options: ListQueryOptions<Coupon>): Promise<PaginatedList<Coupon>>;
    coupon(ctx: RequestContext, id: ID): Promise<Coupon | null>;
    createCoupon(ctx: RequestContext, input: any): Promise<Coupon>;
    updateCoupon(ctx: RequestContext, id: ID, input: any): Promise<Coupon>;
    deleteCoupon(ctx: RequestContext, id: ID): Promise<boolean>;
}
