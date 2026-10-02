import { ID, RequestContext } from '@vendure/core';
import { CouponService } from './coupon.service';
import { InStoreBillService } from './in-store-bill.service';
/**
 * 到店买单（admin-api）：商户端核销 + 流水查询。
 * 核销类操作（券列表/试算/核销）放行店主管理员：`@Allow` 为 OR 语义，平台管理员走 UpdateOrder，
 * 店主走 ManageOwnShop，属店隔离由 service 内的 assertManagedByShop（券模板）二次把关。
 * 流水/汇总两查询仅按 ctx.channelId 隔离、无属店维度（InStoreBill 无 shopId），
 * 故不放行店主，避免同渠道内跨店串看。
 */
export declare class InStoreBillAdminResolver {
    private inStoreBillService;
    private couponService;
    constructor(inStoreBillService: InStoreBillService, couponService: CouponService);
    /** 到店收银：某顾客在当前渠道可到店核销的券列表（仅看场景 IN_STORE/ALL + 未使用/未过期） */
    inStoreCustomerCoupons(ctx: RequestContext, customerId: ID): Promise<import("./customer-coupon.entity").CustomerCoupon[]>;
    inStoreBillQuote(ctx: RequestContext, code: string, originalAmount?: number): Promise<import("./in-store-bill.service").InStoreBillQuote>;
    inStoreBills(ctx: RequestContext, options?: any): Promise<{
        items: import("./in-store-bill.entity").InStoreBill[];
        totalItems: number;
    }>;
    inStoreBillSummary(ctx: RequestContext, options?: any): Promise<{
        count: number;
        originalTotal: number;
        discountTotal: number;
        finalTotal: number;
    }>;
    inStoreBillRedeem(ctx: RequestContext, code: string, originalAmount: number, remark?: string): Promise<import("./in-store-bill.entity").InStoreBill>;
}
