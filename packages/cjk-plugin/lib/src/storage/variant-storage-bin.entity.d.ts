import { DeepPartial } from '@vendure/common/lib/shared-types';
import { VendureEntity } from '@vendure/core';
/**
 * SKU–库位绑定。三档开关共表：
 * - bin 档：zoneId + binId 都写
 * - zone 档：只写 zoneId，binId 为 null
 * - off 档：本表不使用（但表始终存在）
 */
export declare class VariantStorageBin extends VendureEntity {
    constructor(input?: DeepPartial<VariantStorageBin>);
    tenantChannelId: string;
    variantId: number;
    stockLocationId: number;
    /** 必填：zone 档的唯一归属依据 */
    zoneId: number;
    /** 可空：bin 档必填，zone 档恒为 null */
    binId: number | null;
    isDefault: boolean;
}
