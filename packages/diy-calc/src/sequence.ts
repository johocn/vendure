import { feedbackOf, innerCircOf, MAX_COUNT, MIN_COUNT } from './bracelet';
import { aggregate, bomItem, CORD_TAIL, pickCordDiameter } from './shared';
import { CalcBom, CalcBomItem, CalcMaterial, CalcResult, SlotSelection } from './types';

export type SequenceMode = 'alternate' | 'random' | 'zoned';

/** 按 qtyOverride 权重 / 隔片 every 语义把 total 颗分配到各槽位；无权重则均分，余数给第一个槽位 */
function allocateCounts(slots: SlotSelection[], total: number): number[] {
    const counts: number[] = slots.map(() => 0);
    const everyIdx: number[] = [];
    const pool: number[] = [];
    slots.forEach((s, i) => {
        if ((s.qtyOverride ?? 0) > 0) {
            pool.push(i);
        } else if (s.every != null) {
            everyIdx.push(i);
        } else {
            pool.push(i);
        }
    });
    let assigned = 0;
    for (const i of everyIdx) {
        const every = Math.max(1, Math.floor(slots[i].every ?? 2));
        counts[i] = Math.floor(total / (every + 1));
        assigned += counts[i];
    }
    const remaining = total - assigned;
    const weighted = pool.filter(i => (slots[i].qtyOverride ?? 0) > 0);
    if (pool.length === 0) {
        return counts;
    }
    if (weighted.length > 0) {
        const wSum = weighted.reduce((sum, i) => sum + (slots[i].qtyOverride ?? 0), 0);
        let weightedAssigned = 0;
        for (const i of weighted) {
            counts[i] = Math.floor((remaining * (slots[i].qtyOverride ?? 0)) / wSum);
            weightedAssigned += counts[i];
        }
        counts[weighted[0]] += remaining - weightedAssigned; // 余数给第一个有权重槽位
    } else {
        const base = Math.floor(remaining / pool.length);
        for (const i of pool) {
            counts[i] = base;
        }
        counts[pool[0]] += remaining - base * pool.length; // 余数给第一个槽位
    }
    return counts;
}

/** 槽位轮转铺满：每轮取一个仍有余量的槽位 */
function interleave(counts: number[]): number[] {
    const order: number[] = [];
    const remaining = [...counts];
    let left = counts.reduce((s, c) => s + c, 0);
    while (left > 0) {
        for (let i = 0; i < remaining.length; i++) {
            if (remaining[i] > 0) {
                order.push(i);
                remaining[i]--;
                left--;
            }
        }
    }
    return order;
}

/**
 * 自由序列生成（纯函数）：
 * - 先按 qtyOverride 权重把 total 颗分配到各槽位（全部槽位都没权重则均分，余数给第一个槽位）；
 *   带 every 的隔片槽位不参与权重分配，qty = floor(total / (every + 1))
 * - alternate：槽位轮转铺满；random：Fisher-Yates 用注入 rng 洗牌；zoned：按槽位分区
 * - 返回 materialId 有序数组
 */
export function generateSequence(
    slots: SlotSelection[],
    mode: SequenceMode,
    total: number,
    rng: () => number = Math.random,
): string[] {
    if (total <= 0 || slots.length === 0) {
        return [];
    }
    const counts = allocateCounts(slots, total);
    const ids = slots.map(s => s.materialId ?? '');
    let order: number[];
    if (mode === 'alternate') {
        order = interleave(counts);
    } else if (mode === 'random') {
        const pool: number[] = [];
        counts.forEach((c, i) => {
            for (let k = 0; k < c; k++) pool.push(i);
        });
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        order = pool;
    } else {
        order = [];
        counts.forEach((c, i) => {
            for (let k = 0; k < c; k++) order.push(i);
        });
    }
    return order.map(i => ids[i]).filter(id => id !== '');
}

/**
 * 序列几何与算量（纯函数，不抛错）：
 * - decor 不进几何环（按 decorSlots 里出现的 materialId 界定），只计价
 * - 中心线周长 = Σ(每颗 axialLength ?? diameter ?? 8 + gap)；pitchAvg = 中心线/颗数
 * - dAvg = 直径加权平均；内孔复用 innerCircOf(count, pitchAvg, dAvg)；clearance = 内孔 − wristSize
 * - cordLength = 中心线 + CORD_TAIL（打结留量）；cordDiameter 按环上最小孔径选档（decor 不参与）
 * - 空环返回 { calc: null, 空 BOM }
 */
export function sequenceGeometry(
    sequence: string[],
    materials: CalcMaterial[],
    gap: number,
    wristSize: number,
    ease: number = 15,
    decorSlots: SlotSelection[] = [],
): { calc: CalcResult | null; bom: CalcBom } {
    const byId = new Map(materials.map(m => [m.id, m]));
    const decorIds = new Set(decorSlots.map(s => s.materialId).filter((id): id is string => id != null));
    const ring = sequence
        .filter(id => !decorIds.has(id))
        .map(id => byId.get(id))
        .filter((m): m is CalcMaterial => m != null);
    if (ring.length === 0) {
        return { calc: null, bom: { items: [], totalCount: 0, totalAmount: 0, cord: null, geometry: null } };
    }

    const count = ring.length;
    const centerCircumference = ring.reduce((sum, m) => sum + (m.axialLength ?? m.diameter ?? 8) + gap, 0);
    const pitchAvg = centerCircumference / count;
    const dAvg = ring.reduce((sum, m) => sum + (m.diameter ?? m.axialLength ?? 8), 0) / count;
    const innerCircumference = count >= 2 ? innerCircOf(count, pitchAvg, dAvg) : 0;
    const clearance = innerCircumference - wristSize;
    const feedback = feedbackOf(clearance);
    const adjustHint: CalcResult['adjustHint'] = [];
    if (count + 1 <= MAX_COUNT) {
        adjustHint.push({ delta: 1, feedback: feedbackOf(innerCircOf(count + 1, pitchAvg, dAvg) - wristSize) });
    }
    if (count - 1 >= MIN_COUNT) {
        adjustHint.push({ delta: -1, feedback: feedbackOf(innerCircOf(count - 1, pitchAvg, dAvg) - wristSize) });
    }

    // 配线：按环上最小孔径选线径
    const holes = ring.map(m => m.holeSize).filter((h): h is number => h != null);
    const holeMin = holes.length ? Math.min(...holes) : null;
    const cordDiameter = pickCordDiameter(holeMin);

    // BOM：环上素材按 materialId 聚合 + decor 槽位计价行（decor 不影响几何）
    const items: CalcBomItem[] = ring.map(m => bomItem(m, 1));
    for (const slot of decorSlots) {
        const m = slot.materialId ? byId.get(slot.materialId) : undefined;
        if (m) {
            items.push(bomItem(m, Math.max(1, slot.qtyOverride ?? 1)));
        }
    }
    const aggregated = aggregate(items);
    const cordLength = centerCircumference + CORD_TAIL;

    const calc: CalcResult = {
        count,
        countInitial: count,
        centerCircumference,
        innerCircumference,
        feedback,
        clearance,
        adjustHint,
        cordLength,
        cordDiameter,
    };
    const bom: CalcBom = {
        items: aggregated,
        totalCount: aggregated.reduce((s, i) => s + i.qty, 0),
        totalAmount: aggregated.reduce((s, i) => s + i.subtotal, 0),
        cord: { length: cordLength, diameter: cordDiameter, note: '弹力线，打结收尾留量 160mm' },
        geometry: { innerCircumference, feedback, clearance },
    };
    return { calc, bom };
}
