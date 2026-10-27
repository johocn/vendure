/**
 * 配送费阶梯计价（P3-4，2026-10-27）：按订单商品金额分档改变分区运费基价。
 * 命中规则：取「门槛 <= 商品金额」的最高档 fee 作为基价；一档都不满足时回退分区固定运费。
 * 与满 X 元免配送费的关系：满免优先（达标直接 0），阶梯只作用于未满免的订单。
 * 纯函数，便于单测；后台写入走 normalize（严格），结算/展示走 parse（宽松，坏配置不阻断下单）。
 */

export interface DeliveryFeeTier {
    /** 订单商品金额门槛（分，含） */
    minAmount: number;
    /** 该档配送费基价（分） */
    fee: number;
}

/** 档位上限：超过 10 档配置不可维护，直接拒绝 */
export const MAX_DELIVERY_FEE_TIERS = 10;
/** 金额上限（分），与后台金额区间一致 */
const MAX_FEN = 10_000_000;

/** 后台写入：严格校验，任何非法项/重复门槛直接抛错（错误文案直接回显给运营） */
export function normalizeDeliveryFeeTiers(raw: unknown): DeliveryFeeTier[] | null {
    if (raw == null || raw === '') return null;
    if (!Array.isArray(raw)) throw new Error('配送费阶梯必须是数组');
    if (raw.length > MAX_DELIVERY_FEE_TIERS) {
        throw new Error(`配送费阶梯最多 ${MAX_DELIVERY_FEE_TIERS} 档`);
    }
    const byMin = new Map<number, number>();
    for (const item of raw) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new Error('配送费阶梯每一项必须是 { minAmount, fee } 对象');
        }
        const minAmount = Number((item as any).minAmount);
        const fee = Number((item as any).fee);
        if (!Number.isInteger(minAmount) || minAmount < 0 || minAmount > MAX_FEN) {
            throw new Error(`阶梯门槛必须为 0-${MAX_FEN} 的整数（分）`);
        }
        if (!Number.isInteger(fee) || fee < 0 || fee > MAX_FEN) {
            throw new Error(`阶梯配送费必须为 0-${MAX_FEN} 的整数（分）`);
        }
        if (byMin.has(minAmount)) throw new Error(`阶梯门槛 ${minAmount} 重复`);
        byMin.set(minAmount, fee);
    }
    if (!byMin.size) return null;
    return [...byMin.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([minAmount, fee]) => ({ minAmount, fee }));
}

/** 结算/展示：宽松解析（脏项丢弃、门槛去重、超 10 档截断），永不抛错 */
export function parseDeliveryFeeTiers(raw: unknown): DeliveryFeeTier[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<number>();
    const out: DeliveryFeeTier[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        const minAmount = Number((item as any).minAmount);
        const fee = Number((item as any).fee);
        if (!Number.isInteger(minAmount) || minAmount < 0 || minAmount > MAX_FEN) continue;
        if (!Number.isInteger(fee) || fee < 0 || fee > MAX_FEN) continue;
        if (seen.has(minAmount)) continue;
        seen.add(minAmount);
        out.push({ minAmount, fee });
        if (out.length >= MAX_DELIVERY_FEE_TIERS) break;
    }
    return out.sort((a, b) => a.minAmount - b.minAmount);
}

/** 取命中档位：tiers 需已按 minAmount 升序；返回 null 表示未达最低档，调用方回退分区固定运费 */
export function resolveDeliveryFeeTier(tiers: DeliveryFeeTier[], goods: number): DeliveryFeeTier | null {
    let hit: DeliveryFeeTier | null = null;
    for (const t of tiers) {
        if (goods >= t.minAmount) hit = t;
        else break;
    }
    return hit;
}
