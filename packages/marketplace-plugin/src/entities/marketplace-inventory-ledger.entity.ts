import { DeepPartial, ID } from '@vendure/common/lib/shared-types';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { EntityId, ProductVariant, VendureEntity } from '@vendure/core';

/**
 * @description
 * 供销存中间表：记录商品在各销售来源（marketplace / 独立店）下的供给、销售、库存关系的时效性。
 * 为复杂统计提供关联查询（供 Task10 对账使用）。
 *
 * 说明：Vendure v3 中 `Orderable` 仅是一个 `{ position: number }` 接口，并非基类，
 * 因此本实体继承 `VendureEntity`（含 id / createdAt / updatedAt）。
 */
@Entity()
export class MarketplaceInventoryLedger extends VendureEntity {
    constructor(input?: DeepPartial<MarketplaceInventoryLedger>) {
        super(input);
    }

    @Index()
    @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE' })
    variant: ProductVariant;

    @EntityId()
    variantId: ID;

    @Index()
    @Column()
    merchantChannelId: string;

    @Index()
    @Column()
    saleSource: string;

    @Column({ type: 'int' })
    stockBefore: number;

    @Column({ type: 'int' })
    stockAfter: number;

    @Column({ type: 'int' })
    stockDelta: number;

    @Column()
    actionType: string; // 上架/补货/销售/发货/核销/审批

    @Column({ type: 'timestamp' })
    validFrom: Date;

    @Column({ type: 'timestamp', nullable: true })
    validTo: Date | null;

    @Index()
    @Column({ type: 'varchar', nullable: true })
    orderId: string | null;
}