"use strict";
// 房价方案纯逻辑（无副作用，供服务/计价策略与 vitest 共用）
// 口径（design §5）：
// - discount：每晚 price × adjustValue/1000（连住优惠继续叠加到总价）
// - fixed：每晚 = adjustValue（连住优惠不再叠加——固定价直接生效）
// - surcharge：每晚 price + adjustValue（连住优惠继续叠加）
// - 坏 code / 未启用 / 不在售卖期 / 会员不达标 → 视为无方案，回退基价
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyNightlyAdjustment = applyNightlyAdjustment;
exports.isValidRatePlanAdjustment = isValidRatePlanAdjustment;
exports.parseMemberOnly = parseMemberOnly;
exports.isRatePlanSaleable = isRatePlanSaleable;
/** 单晚基准价 + 方案 → 单晚方案价（调用方保证 adjustType 合法） */
function applyNightlyAdjustment(basePriceCent, adj) {
    switch (adj.adjustType) {
        case 'discount':
            return Math.round((basePriceCent * adj.adjustValue) / 1000);
        case 'fixed':
            return Math.round(adj.adjustValue);
        case 'surcharge':
            return basePriceCent + Math.round(adj.adjustValue);
        default:
            return basePriceCent;
    }
}
/** 方案形态校验（CRUD 与策略层共用）：adjustType 三选一 + adjustValue 有限且 ≥0（discount 上限 1000） */
function isValidRatePlanAdjustment(adj) {
    if (!adj || typeof adj !== 'object')
        return false;
    const a = adj;
    if (a.adjustType !== 'discount' && a.adjustType !== 'fixed' && a.adjustType !== 'surcharge')
        return false;
    if (typeof a.adjustValue !== 'number' || !Number.isFinite(a.adjustValue) || a.adjustValue < 0)
        return false;
    if (a.adjustType === 'discount' && (a.adjustValue < 1 || a.adjustValue > 1000))
        return false;
    if (a.adjustType === 'fixed' && a.adjustValue === 0)
        return false;
    return true;
}
/**
 * memberOnly 解析：数字字符串 → 会员等级门槛；null/空 → null（全员）；
 * 非法（非数字）→ NaN（调用方按「不可见/不可用」fail-closed 处理）
 */
function parseMemberOnly(raw) {
    if (raw == null || String(raw).trim() === '')
        return null;
    const n = Number(String(raw).trim());
    return Number.isFinite(n) ? n : NaN;
}
/**
 * 方案对「某顾客 + 某入住日」是否可售（C 端可见性与下单套用共用同一口径）：
 * - memberOnly：null = 全员；数字 n = 顾客 memberLevel ≥ n；顾客未登录（memberLevel null）不可见；门槛非法不可见
 *   （会员门槛无条件校验，不随 checkIn 缺省跳过——fail-closed）
 * - dateFrom/dateTo：入住日 checkIn 落在 [dateFrom, dateTo]（含两端）；null 端 = 不限；
 *   checkIn 缺省（如 C 端不带日期拉方案列表）= 跳过售卖期判定；提供了但格式坏 = fail-closed 不可售
 */
function isRatePlanSaleable(plan, checkIn, memberLevel) {
    const gate = parseMemberOnly(plan.memberOnly);
    if (gate == null) {
        // 全员可见
    }
    else if (Number.isNaN(gate) || memberLevel == null || memberLevel < gate) {
        return false;
    }
    const d = typeof checkIn === 'string' ? checkIn.trim().slice(0, 10) : '';
    if (!d)
        return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d))
        return false;
    const from = plan.dateFrom ? String(plan.dateFrom).slice(0, 10) : null;
    const to = plan.dateTo ? String(plan.dateTo).slice(0, 10) : null;
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from) && d < from)
        return false;
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to) && d > to)
        return false;
    return true;
}
//# sourceMappingURL=rate-plan-logic.js.map