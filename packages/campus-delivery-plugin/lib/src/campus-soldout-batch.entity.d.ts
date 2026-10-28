import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 全店沽清批次登记（§66）：只记录「通过全店沽清」被标记售罄的商品，
 * 次日 04:00 自动恢复时仅恢复这些商品，单品手动沽清不受影响。
 * 表由 migration p11-soldout-auto-restore 创建（生产 synchronize:false）。
 */
export declare class CampusSoldOutBatch extends VendureEntity {
    constructor(input?: DeepPartial<CampusSoldOutBatch>);
    channelId: number;
    productId: number;
}
