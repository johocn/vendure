import { DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 变体 × 物理仓 绑定。某变体有绑定记录 => 物理驱动变体：
 * 虚拟库存 = Σ 绑定物理仓 onHand（镜像），销售分配只落绑定物理仓。
 */
@Entity()
export class VariantLocationBinding extends VendureEntity {
    constructor(input?: DeepPartial<VariantLocationBinding>) {
        super(input);
    }

    @Index()
    @Column('varchar')
    variantId: ID;

    @Index()
    @Column('varchar')
    locationId: ID;

    @Column({ type: 'boolean', default: false })
    isDefault: boolean;
}
