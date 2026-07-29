import { ID, ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { CouponService } from '@vendure/coupon-plugin';
export declare class CouponMarketingService {
    private couponService;
    constructor(couponService: CouponService);
    private assertPermission;
    findAll(ctx: RequestContext, options?: ListQueryOptions<any>): Promise<PaginatedList<any>>;
    findOne(ctx: RequestContext, id: ID): Promise<any | null>;
    create(ctx: RequestContext, input: any): Promise<any>;
    update(ctx: RequestContext, id: ID, input: any): Promise<any>;
    delete(ctx: RequestContext, id: ID): Promise<boolean>;
    enableForChannel(ctx: RequestContext, id: ID): Promise<any>;
    disableForChannel(ctx: RequestContext, id: ID): Promise<any>;
}
