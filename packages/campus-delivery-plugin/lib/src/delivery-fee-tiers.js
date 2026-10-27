"use strict";
/**
 * 配送费阶梯计价（P3-4，2026-10-27）：按订单商品金额分档改变分区运费基价。
 * 命中规则：取「门槛 <= 商品金额」的最高档 fee 作为基价；一档都不满足时回退分区固定运费。
 * 与满 X 元免配送费的关系：满免优先（达标直接 0），阶梯只作用于未满免的订单。
 * 纯函数，便于单测；后台写入走 normalize（严格），结算/展示走 parse（宽松，坏配置不阻断下单）。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_DELIVERY_FEE_TIERS = void 0;
exports.normalizeDeliveryFeeTiers = normalizeDeliveryFeeTiers;
exports.parseDeliveryFeeTiers = parseDeliveryFeeTiers;
exports.resolveDeliveryFeeTier = resolveDeliveryFeeTier;
/** 档位上限：超过 10 档配置不可维护，直接拒绝 */
exports.MAX_DELIVERY_FEE_TIERS = 10;
/** 金额上限（分），与后台金额区间一致 */
const MAX_FEN = 10000000;
/** 后台写入：严格校验，任何非法项/重复门槛直接抛错（错误文案直接回显给运营） */
function normalizeDeliveryFeeTiers(raw) {
    if (raw == null || raw === '')
        return null;
    if (!Array.isArray(raw))
        throw new Error('配送费阶梯必须是数组');
    if (raw.length > exports.MAX_DELIVERY_FEE_TIERS) {
        throw new Error(`配送费阶梯最多 ${exports.MAX_DELIVERY_FEE_TIERS} 档`);
    }
    const byMin = new Map();
    for (const item of raw) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new Error('配送费阶梯每一项必须是 { minAmount, fee } 对象');
        }
        const minAmount = Number(item.minAmount);
        const fee = Number(item.fee);
        if (!Number.isInteger(minAmount) || minAmount < 0 || minAmount > MAX_FEN) {
            throw new Error(`阶梯门槛必须为 0-${MAX_FEN} 的整数（分）`);
        }
        if (!Number.isInteger(fee) || fee < 0 || fee > MAX_FEN) {
            throw new Error(`阶梯配送费必须为 0-${MAX_FEN} 的整数（分）`);
        }
        if (byMin.has(minAmount))
            throw new Error(`阶梯门槛 ${minAmount} 重复`);
        byMin.set(minAmount, fee);
    }
    if (!byMin.size)
        return null;
    return [...byMin.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([minAmount, fee]) => ({ minAmount, fee }));
}
/** 结算/展示：宽松解析（脏项丢弃、门槛去重、超 10 档截断），永不抛错 */
function parseDeliveryFeeTiers(raw) {
    if (!Array.isArray(raw))
        return [];
    const seen = new Set();
    const out = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object' || Array.isArray(item))
            continue;
        const minAmount = Number(item.minAmount);
        const fee = Number(item.fee);
        if (!Number.isInteger(minAmount) || minAmount < 0 || minAmount > MAX_FEN)
            continue;
        if (!Number.isInteger(fee) || fee < 0 || fee > MAX_FEN)
            continue;
        if (seen.has(minAmount))
            continue;
        seen.add(minAmount);
        out.push({ minAmount, fee });
        if (out.length >= exports.MAX_DELIVERY_FEE_TIERS)
            break;
    }
    return out.sort((a, b) => a.minAmount - b.minAmount);
}
/** 取命中档位：tiers 需已按 minAmount 升序；返回 null 表示未达最低档，调用方回退分区固定运费 */
function resolveDeliveryFeeTier(tiers, goods) {
    let hit = null;
    for (const t of tiers) {
        if (goods >= t.minAmount)
            hit = t;
        else
            break;
    }
    return hit;
}
//# sourceMappingURL=delivery-fee-tiers.js.map