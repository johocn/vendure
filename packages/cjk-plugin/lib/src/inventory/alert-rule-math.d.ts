/** 渠道无默认值时的兜底安全库存（与设计规格一致，不要再改这个常量） */
export declare const DEFAULT_SAFETY_STOCK = 10;
/** 预警规则的最小结构（实体 / GraphQL 输入 / 前端镜像都可满足） */
export interface AlertRuleLike {
    variantId: string | number;
    locationId: string | number;
    safetyStock: number;
    enabled: boolean;
}
/**
 * 安全库存四级回退（纯函数，可单测）：
 *   SKU×仓规则(enabled) → SKU 全仓规则(locationId=0, enabled) → 渠道 inventoryDefaultSafetyStock → 常量 10
 *
 * `locationId` 为空/`0` 表示「聚合视图 / 全仓通用」口径：跳过仓级规则，直接看全仓规则。
 */
export declare function resolveSafetyStock(input: {
    variantId: string | number;
    locationId?: string | number | null;
    rules: AlertRuleLike[];
    channelDefault?: number | null;
}): number;
