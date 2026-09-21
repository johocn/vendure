import { DeepPartial } from '@vendure/common/lib/shared-types';
import { VendureEntity } from '@vendure/core';
export declare class StorageBin extends VendureEntity {
    constructor(input?: DeepPartial<StorageBin>);
    tenantChannelId: string;
    stockLocationId: number;
    zoneId: number;
    /** 完整库位编码，如 A-01-03 */
    code: string;
    /** 货架号。排序用数字，避免 A-10 < A-2 的字符串排序坑 */
    rowNo: number;
    /** 层号 */
    levelNo: number;
    enabled: boolean;
}
