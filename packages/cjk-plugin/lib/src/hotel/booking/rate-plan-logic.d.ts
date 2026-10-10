export type RatePlanAdjustType = 'discount' | 'fixed' | 'surcharge';
/** 计价所需的最小方案形态（策略层从 OrderLine.customFields.ratePlanCode 解析出实体后裁剪传入） */
export interface RatePlanAdjustment {
    adjustType: RatePlanAdjustType;
    adjustValue: number;
}
/** 可售性判定所需的最小方案形态 */
export interface RatePlanSaleShape {
    memberOnly?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
}
/** 单晚基准价 + 方案 → 单晚方案价（调用方保证 adjustType 合法） */
export declare function applyNightlyAdjustment(basePriceCent: number, adj: RatePlanAdjustment): number;
/** 方案形态校验（CRUD 与策略层共用）：adjustType 三选一 + adjustValue 有限且 ≥0（discount 上限 1000） */
export declare function isValidRatePlanAdjustment(adj: unknown): adj is RatePlanAdjustment;
/**
 * memberOnly 解析：数字字符串 → 会员等级门槛；null/空 → null（全员）；
 * 非法（非数字）→ NaN（调用方按「不可见/不可用」fail-closed 处理）
 */
export declare function parseMemberOnly(raw: string | null | undefined): number | null;
/**
 * 方案对「某顾客 + 某入住日」是否可售（C 端可见性与下单套用共用同一口径）：
 * - memberOnly：null = 全员；数字 n = 顾客 memberLevel ≥ n；顾客未登录（memberLevel null）不可见；门槛非法不可见
 *   （会员门槛无条件校验，不随 checkIn 缺省跳过——fail-closed）
 * - dateFrom/dateTo：入住日 checkIn 落在 [dateFrom, dateTo]（含两端）；null 端 = 不限；
 *   checkIn 缺省（如 C 端不带日期拉方案列表）= 跳过售卖期判定；提供了但格式坏 = fail-closed 不可售
 */
export declare function isRatePlanSaleable(plan: RatePlanSaleShape, checkIn: string | null | undefined, memberLevel: number | null): boolean;
