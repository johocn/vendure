import { ID, RequestContext } from '@vendure/core';
import { ShippingProfileService } from './shipping-profile.service';
import { PickupLocation } from '../pickup/pickup-location.entity';
export declare class ShippingProfileShopResolver {
    private service;
    constructor(service: ShippingProfileService);
    eligibleShippingMethodsByProfile(ctx: RequestContext, profileIds: ID[]): Promise<any[]>;
    checkShippingProfileCompatibility(ctx: RequestContext, profileIds: ID[]): Promise<{
        compatible: boolean;
        intersectedCount: number;
    }>;
    eligibleShippingMethodsWithConfig(ctx: RequestContext, profileIds: ID[]): Promise<any[]>;
    resolveShippingMethodsForChannel(ctx: RequestContext): Promise<any[]>;
    /**
     * 按 Profile 交集查询允许的自提点。
     * 返回值语义：
     * - []  → 所有 Profile 都未约束自提点（前端展示全部），或交集为空（前端展示"无可用"）
     * - [locations] → 交集非空，前端仅展示这些自提点
     * 前端需配合 checkPickupLocationConstraint 查询区分两种 [] 情况
     */
    eligiblePickupLocationsByProfile(ctx: RequestContext, profileIds: ID[]): Promise<PickupLocation[]>;
    checkPickupLocationConstraint(ctx: RequestContext, profileIds: ID[]): Promise<boolean>;
}
