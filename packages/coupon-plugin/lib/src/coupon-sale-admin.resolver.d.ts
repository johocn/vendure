import { ID, RequestContext } from '@vendure/core';
import { CouponSaleService } from './coupon-sale.service';
/**
 * 券商城后台（admin-api）：券包 CRUD、出售单流水查询与退款。
 * 权限对齐订单管理（Permission.UpdateOrder），渠道隔离在 service 内按 ctx.channelId 过滤。
 */
export declare class CouponSaleAdminResolver {
    private couponSaleService;
    constructor(couponSaleService: CouponSaleService);
    couponBundles(ctx: RequestContext, options?: any): Promise<{
        items: import("./coupon-bundle.entity").CouponBundle[];
        totalItems: number;
    }>;
    couponBundle(ctx: RequestContext, id: ID): Promise<import("./coupon-bundle.entity").CouponBundle | undefined>;
    couponSaleOrders(ctx: RequestContext, options?: any): Promise<{
        items: import("./coupon-sale-order.entity").CouponSaleOrder[];
        totalItems: number;
    }>;
    couponSaleOrder(ctx: RequestContext, id: ID): Promise<import("./coupon-sale-order.entity").CouponSaleOrder | undefined>;
    createCouponBundle(ctx: RequestContext, input: any): Promise<import("./coupon-bundle.entity").CouponBundle>;
    updateCouponBundle(ctx: RequestContext, id: ID, input: any): Promise<import("./coupon-bundle.entity").CouponBundle>;
    deleteCouponBundle(ctx: RequestContext, id: ID): Promise<boolean>;
    refundCouponSaleOrder(ctx: RequestContext, id: ID, reason?: string): Promise<import("./coupon-sale-order.entity").CouponSaleOrder>;
}
