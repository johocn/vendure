import { DeepPartial, ID } from '@vendure/common/lib/shared-types';
import { ProductVariant, VendureEntity } from '@vendure/core';
/**
 * @description
 * 供销存中间表：记录商品在各销售来源（marketplace / 独立店）下的供给、销售、库存关系的时效性。
 * 为复杂统计提供关联查询（供 Task10 对账使用）。
 *
 * 说明：Vendure v3 中 `Orderable` 仅是一个 `{ position: number }` 接口，并非基类，
 * 因此本实体继承 `VendureEntity`（含 id / createdAt / updatedAt）。
 */
export declare class MarketplaceInventoryLedger extends VendureEntity {
    constructor(input?: DeepPartial<MarketplaceInventoryLedger>);
    variant: ProductVariant;
    variantId: ID;
    merchantChannelId: string;
    saleSource: string;
    stockBefore: number;
    stockAfter: number;
    stockDelta: number;
    actionType: string;
    validFrom: Date;
    validTo: Date | null;
    orderId: string | null;
}
