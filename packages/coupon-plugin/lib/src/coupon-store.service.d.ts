import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { MerchantStoreService } from '@vendure/merchant-plugin';
import { CouponService } from './coupon.service';
import { CouponStoreBinding } from './coupon-store-binding.entity';
import { CouponRedemption } from './coupon-redemption.entity';
/** 门店可选项（shop-api CouponStoreOption 的载体） */
export interface CouponStoreOption {
    id: number;
    name: string;
    address: string;
    phoneNumber: string | null;
    businessHoursText: string | null;
    isOpenNow: boolean;
    distanceKm: number | null;
    lat: number | null;
    lng: number | null;
    photos: string[];
}
/** 到店核销结果 */
export interface CouponRedemptionResult {
    couponId: number;
    couponCode: string;
    status: string;
    storeId: number;
    storeName: string;
    redeemedAt: Date;
}
/**
 * 券 ↔ 门店联动服务。
 *
 * 回归红线：模板无任何 coupon_store_binding 记录（默认 storeCoverage='ALL'）时，
 * assertStoreCoverage 直接放行、门店列表回退为「附近全部门店」，历史券行为完全不变。
 * merchant-plugin 未装载（独立部署 / 纯券 e2e）时，门店相关能力降级为空列表，
 * 仅显式传入门店的操作才报错，不影响既有链路。
 */
export declare class CouponStoreService {
    private connection;
    private couponService;
    private merchantStoreService?;
    constructor(connection: TransactionalConnection, couponService: CouponService, merchantStoreService?: MerchantStoreService | undefined);
    /** 当前渠道下模板的门店绑定 */
    private findBindings;
    /** 模板可用门店列表：无绑定 → 附近全部门店；有绑定 → 绑定门店（坐标场景保持距离排序） */
    templateStores(ctx: RequestContext, templateId: ID, lat?: number | null, lng?: number | null): Promise<CouponStoreOption[]>;
    /** 按券码取本人券 → 模板 → 可用门店列表（与 getMyCouponByCode 同口径） */
    storesForCoupon(ctx: RequestContext, code: string, lat?: number | null, lng?: number | null): Promise<CouponStoreOption[]>;
    /**
     * 门店覆盖校验：无绑定行直接放行（历史券不变）；
     * 有绑定行时 storeId 必须在 INCLUDE 集合内（若存在 INCLUDE）且不在 EXCLUDE 集合。
     */
    assertStoreCoverage(ctx: RequestContext, templateId: ID, storeId: ID): Promise<void>;
    /** 购券时解析门店快照（不要求门店当下营业，不阻断购券） */
    resolveStoreSnapshot(ctx: RequestContext, storeId: ID): Promise<{
        storeId: number;
        snapshot: Record<string, any>;
    }>;
    /** 到店核销：校验持有/状态/有效期/覆盖范围/门店可核销后置 USED 并写核销流水 */
    redeemAtStore(ctx: RequestContext, code: string, storeId: ID): Promise<CouponRedemptionResult>;
    listBindings(ctx: RequestContext, templateId: ID): Promise<CouponStoreBinding[]>;
    /**
     * 全量替换模板门店绑定：空数组 → storeCoverage='ALL'（不限门店），
     * 否则 storeCoverage = coverage || 'STORE'。
     */
    setBindings(ctx: RequestContext, templateId: ID, storeIds: ID[], coverage?: string | null): Promise<CouponStoreBinding[]>;
    listRedemptions(ctx: RequestContext, templateId?: ID | null, storeId?: ID | null, limit?: number | null): Promise<CouponRedemption[]>;
    private requireStoreService;
    /** 统一门店形态：已是公开投影（含 coordinates 字段）则直接使用，否则用 toPublic 转换 */
    private asPublic;
}
