/**
 * 库存预警规则（安全库存）。
 *
 * 唯一键 `(tenantChannelId, variantId, locationId)`；`locationId = 0` 为**哨兵值**，
 * 语义 =「该 SKU 在本租户全部仓通用」，不用 nullable 以规避不同数据库对 NULL 唯一索引的差异。
 * `safetyStock = 0` 合法，语义 = 该 SKU 不再进入低库存预警。
 */
export declare class InventoryAlertRuleEntity {
    id: number;
    /** 归属租户渠道编码（沿用 stock_doc 的 scoping 口径：ctx.channel.code） */
    tenantChannelId: string;
    variantId: number;
    /** 0 = 全部仓通用；>0 = 指定仓覆盖 */
    locationId: number;
    safetyStock: number;
    enabled: boolean;
    updatedAt: Date;
}
