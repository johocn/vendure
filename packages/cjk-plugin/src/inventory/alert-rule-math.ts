/** 渠道无默认值时的兜底安全库存（与设计规格一致，不要再改这个常量） */
export const DEFAULT_SAFETY_STOCK = 10;

/** 预警规则的最小结构（实体 / GraphQL 输入 / 前端镜像都可满足） */
export interface AlertRuleLike {
    variantId: string | number;
    locationId: string | number;
    safetyStock: number;
    enabled: boolean;
}

const asId = (v: string | number | null | undefined): string => String(v ?? '');

/** 规整为「非负整数」；非法值退回常量 10 */
function norm(value: number): number {
    const v = Math.trunc(Number(value));
    return Number.isFinite(v) ? Math.max(0, v) : DEFAULT_SAFETY_STOCK;
}

/**
 * 安全库存四级回退（纯函数，可单测）：
 *   SKU×仓规则(enabled) → SKU 全仓规则(locationId=0, enabled) → 渠道 inventoryDefaultSafetyStock → 常量 10
 *
 * `locationId` 为空/`0` 表示「聚合视图 / 全仓通用」口径：跳过仓级规则，直接看全仓规则。
 */
export function resolveSafetyStock(input: {
    variantId: string | number;
    locationId?: string | number | null;
    rules: AlertRuleLike[];
    channelDefault?: number | null;
}): number {
    const vid = asId(input.variantId);
    const lid = asId(input.locationId) || '0';
    const enabled = (input.rules ?? []).filter(r => r && r.enabled !== false);

    if (lid !== '0') {
        const exact = enabled.find(r => asId(r.variantId) === vid && asId(r.locationId) === lid);
        if (exact) {
            return norm(exact.safetyStock);
        }
    }
    const all = enabled.find(r => asId(r.variantId) === vid && asId(r.locationId) === '0');
    if (all) {
        return norm(all.safetyStock);
    }
    if (input.channelDefault !== null && input.channelDefault !== undefined) {
        const def = Number(input.channelDefault);
        if (Number.isFinite(def)) {
            return norm(def);
        }
    }
    return DEFAULT_SAFETY_STOCK;
}