import { ID, RequestContext } from '@vendure/core';
import { CouponStoreService } from './coupon-store.service';
/**
 * 券 ↔ 门店（shop-api）：
 * - couponTemplateStores：券模板可用门店（无绑定 = 附近全部门店，历史券不变）
 * - couponStoresForCoupon：按券码查本人券的可用门店
 * - redeemCouponAtStore：到店核销（需登录，本人券）
 */
export declare class CouponStoreShopResolver {
    private couponStoreService;
    constructor(couponStoreService: CouponStoreService);
    couponTemplateStores(ctx: RequestContext, templateId: ID, lat?: number, lng?: number): Promise<import("./coupon-store.service").CouponStoreOption[]>;
    couponStoresForCoupon(ctx: RequestContext, code: string, lat?: number, lng?: number): Promise<import("./coupon-store.service").CouponStoreOption[]>;
    redeemCouponAtStore(ctx: RequestContext, couponCode: string, storeId: ID): Promise<import("./coupon-store.service").CouponRedemptionResult>;
}
