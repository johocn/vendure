import { DeepPartial, ID, VendureEntity } from '@vendure/core';
/**
 * 变体 × 物理仓 绑定。某变体有绑定记录 => 物理驱动变体：
 * 虚拟库存 = Σ 绑定物理仓 onHand（镜像），销售分配只落绑定物理仓。
 */
export declare class VariantLocationBinding extends VendureEntity {
    constructor(input?: DeepPartial<VariantLocationBinding>);
    variantId: ID;
    locationId: ID;
    isDefault: boolean;
}
