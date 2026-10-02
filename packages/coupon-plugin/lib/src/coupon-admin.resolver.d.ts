import { ID, ListQueryOptions, RequestContext } from '@vendure/core';
import { CouponService } from './coupon.service';
import { CouponTemplate } from './coupon-template.entity';
import { CustomerCoupon } from './customer-coupon.entity';
/**
 * 优惠券 admin 接口：平台管理员（UpdateOrder）与店主管理员（ManageOwnShop）共用同一 GraphQL 面。
 * `@Allow` 为 OR 语义（任一权限命中即放行），店主须能进入本 resolver，属店隔离再由
 * service 层 resolveShopIdFromActiveUser / assertManagedByShop 与列表过滤兜底；
 * 否则店主在权限闸门即被拒，service 内的隔离逻辑对店主不可达。
 */
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
    couponChannelCustomers(ctx: RequestContext, query?: string, take?: number, skip?: number): Promise<{
        items: import("@vendure/core").Customer[];
        totalItems: number;
    }>;
    grantCouponIssue(ctx: RequestContext, templateId: ID, customerIds: ID[], notify: boolean): Promise<{
        customerId: ID;
        ok: boolean;
        code: string | null;
        reason: string | null;
    }[]>;
}
