import { ID, RequestContext } from '@vendure/core';
import { CouponStoreService } from './coupon-store.service';
/**
 * 券 ↔ 门店（admin-api）：绑定维护 + 核销流水查询。
 * 权限对齐订单管理（Permission.UpdateOrder），渠道隔离在 service 内按 ctx.channelId 过滤。
 */
export declare class CouponStoreAdminResolver {
    private couponStoreService;
    constructor(couponStoreService: CouponStoreService);
    couponStoreBindings(ctx: RequestContext, templateId: ID): Promise<import("./coupon-store-binding.entity").CouponStoreBinding[]>;
    setCouponStoreBindings(ctx: RequestContext, templateId: ID, storeIds: ID[], coverage?: string): Promise<import("./coupon-store-binding.entity").CouponStoreBinding[]>;
    couponRedemptions(ctx: RequestContext, templateId?: ID, storeId?: ID, limit?: number): Promise<import("./coupon-redemption.entity").CouponRedemption[]>;
}
