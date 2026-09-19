import { CustomerService, RequestContext } from '@vendure/core';
import { CouponService } from './coupon.service';
/**
 * CustomerCoupon.template 关系字段解析。
 * claimCoupon / grantCouponIssue 返回的实例未预加载 template 关联，
 * 若无字段解析器则 GraphQL 输出 template:null。此处按 templateId 补查并复用
 * findOneTemplate（顺带应用本地化与属店隔离，shop 会话下 adminShopId 为 undefined 不拦截）。
 */
export declare class CustomerCouponResolver {
    private couponService;
    private customerService;
    constructor(couponService: CouponService, customerService: CustomerService);
    template(cc: any, ctx: RequestContext): Promise<any>;
    /** 领取/核销明细需要客户名/手机号（管理后台展示用），未命中返回 null */
    customer(cc: any, ctx: RequestContext): Promise<import("@vendure/core").Customer | null | undefined>;
}
