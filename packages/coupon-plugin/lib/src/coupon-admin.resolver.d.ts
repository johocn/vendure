import { ID, ListQueryOptions, RequestContext } from '@vendure/core';
import { CouponService } from './coupon.service';
import { CouponFissionService } from './coupon-fission.service';
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
    private fissionService;
    constructor(couponService: CouponService, fissionService: CouponFissionService);
    couponTemplates(ctx: RequestContext, options: ListQueryOptions<CouponTemplate>): Promise<{
        items: CouponTemplate[];
        totalItems: number;
    }>;
    couponTemplate(ctx: RequestContext, id: ID): Promise<CouponTemplate | undefined>;
    customerCoupons(ctx: RequestContext, options: ListQueryOptions<CustomerCoupon>): Promise<{
        items: CustomerCoupon[];
        totalItems: number;
    }>;
    /** 核销看板（FR-A3）：按模板聚合领券量/核销量/核销率/过期率，时间筛选按领取时间闭区间 */
    couponRedemptionStats(ctx: RequestContext, templateId?: string, from?: string, to?: string): Promise<{
        templateId: number;
        name: string | null;
        claimed: number;
        used: number;
        expired: number;
        unused: number;
        returned: number;
        invalid: number;
        redemptionRate: number;
        expiredRate: number;
    }[]>;
    /** E1 沉睡召回：圈人预览（只数不发） */
    couponWinBackPreviewCount(ctx: RequestContext, days: number): Promise<number>;
    /** E1 沉睡召回：批量发放（RECALL 渠道留痕 + R4 防骚扰），返回批次留痕 */
    couponWinBackGrant(ctx: RequestContext, templateId: ID, days: number, notify?: boolean): Promise<import("./coupon-grant-batch.entity").CouponGrantBatch>;
    /** E1 批次留痕查询（结果可查） */
    couponGrantBatches(ctx: RequestContext, take?: number): Promise<import("./coupon-grant-batch.entity").CouponGrantBatch[]>;
    /** FR-C 裂变记录查询（R1 渠道留痕核对） */
    couponFissionRecords(ctx: RequestContext, take?: number): Promise<import("./coupon-fission-record.entity").CouponFissionRecord[]>;
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
