import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 配送档案 × 配送方式 的 join 载荷实体。
 * 存放某一配送方式在某档案下的工作模式（options）。
 * - mode='pickup' → options.pickupLocationIds = 该方式在该档案下允许的自提点集合
 * - mode='mail'   → 范围/运费公式仍留在 Vendure ShippingMethod 实例，options 可选
 */
export declare class ShippingProfileMethod extends VendureEntity {
    constructor(input?: DeepPartial<ShippingProfileMethod>);
    profileId: string;
    shippingMethodId: string;
    mode: string;
    options: Record<string, any> | null;
}
