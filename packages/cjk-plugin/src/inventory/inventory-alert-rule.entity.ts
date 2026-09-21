import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 库存预警规则（安全库存）。
 *
 * 唯一键 `(tenantChannelId, variantId, locationId)`；`locationId = 0` 为**哨兵值**，
 * 语义 =「该 SKU 在本租户全部仓通用」，不用 nullable 以规避不同数据库对 NULL 唯一索引的差异。
 * `safetyStock = 0` 合法，语义 = 该 SKU 不再进入低库存预警。
 */
@Entity('inventory_alert_rule')
@Index('uq_inventory_alert_rule_scope', ['tenantChannelId', 'variantId', 'locationId'], { unique: true })
export class InventoryAlertRuleEntity {
    @PrimaryGeneratedColumn('increment')
    id!: number;

    /** 归属租户渠道编码（沿用 stock_doc 的 scoping 口径：ctx.channel.code） */
    @Column()
    tenantChannelId!: string;

    @Column({ type: 'int' })
    variantId!: number;

    /** 0 = 全部仓通用；>0 = 指定仓覆盖 */
    @Column({ type: 'int', default: 0 })
    locationId!: number;

    @Column({ type: 'int', default: 10 })
    safetyStock!: number;

    @Column({ type: 'boolean', default: true })
    enabled!: boolean;

    @Column({ nullable: true })
    updatedAt!: Date;
}