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
    /**
     * MarketingCoupon schema 类型没有 enabledInCurrentChannel 字段解析器，
     * 需在 service 层计算并附加到返回对象上，供 GraphQL 直接读取。
     */
    private attachEnabledInCurrentChannel;
}
