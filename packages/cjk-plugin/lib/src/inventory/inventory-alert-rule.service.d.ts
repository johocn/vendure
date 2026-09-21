import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { AlertRuleLike } from './alert-rule-math';
import { InventoryAlertRuleEntity } from './inventory-alert-rule.entity';
import { VirtualPhysicalStockService } from './virtual-physical-stock.service';
/** 保存入参（与 GraphQL `input InventoryAlertRuleInput` 一一对应） */
export interface InventoryAlertRuleInput {
    variantId: ID;
    safetyStock: number;
    enabled?: boolean | null;
    locationId?: ID | null;
}
/**
 * 库存预警规则（安全库存）读写。
 * 读：渠道默认值 + 指定变体集在本租户的规则 + 指定仓规则列表；写：幂等 upsert。
 * 哨兵口径：`locationId = 0` 表示「该 SKU 在本租户全部仓通用」（与实体注释一致）。
 */
export declare class InventoryAlertRuleService {
    private conn;
    private virtualPhysicalStockService;
    constructor(conn: TransactionalConnection, virtualPhysicalStockService: VirtualPhysicalStockService);
    /** 渠道级默认安全库存（未配置/非法 → null，由 resolveSafetyStock 落到常量 10） */
    channelDefault(ctx: RequestContext): number | null;
    /** 取指定变体在本租户的全部规则（含 locationId=0 的全仓通用规则） */
    rulesForVariants(ctx: RequestContext, variantIds: string[]): Promise<AlertRuleLike[]>;
    /** 哨兵归一：空/缺省 → 0（全仓通用）；非法/负数 → 拒绝 */
    private normLocationId;
    /** 指定仓的规则列表（locationId 缺省 → 哨兵 0 = 全仓通用规则） */
    list(ctx: RequestContext, locationId?: ID | null): Promise<InventoryAlertRuleEntity[]>;
    /**
     * 幂等 upsert（唯一键 tenantChannelId + variantId + locationId），返回该仓最新规则列表。
     * 校验：非本租户仓 / 变体不存在或不属于当前渠道 / safetyStock < 0 一律拒绝；
     * `safetyStock = 0` 合法（语义 = 该 SKU 不再进入低库存预警）。
     */
    save(ctx: RequestContext, locationId: ID | null | undefined, items: InventoryAlertRuleInput[]): Promise<InventoryAlertRuleEntity[]>;
}
