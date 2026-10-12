"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSequence = generateSequence;
exports.sequenceGeometry = sequenceGeometry;
const bracelet_1 = require("./bracelet");
const shared_1 = require("./shared");
/** 按 qtyOverride 权重 / 隔片 every 语义把 total 颗分配到各槽位；无权重则均分，余数给第一个槽位 */
function allocateCounts(slots, total) {
    var _a, _b;
    const counts = slots.map(() => 0);
    const everyIdx = [];
    const pool = [];
    slots.forEach((s, i) => {
        var _a;
        if (((_a = s.qtyOverride) !== null && _a !== void 0 ? _a : 0) > 0) {
            pool.push(i);
        }
        else if (s.every != null) {
            everyIdx.push(i);
        }
        else {
            pool.push(i);
        }
    });
    let assigned = 0;
    for (const i of everyIdx) {
        const every = Math.max(1, Math.floor((_a = slots[i].every) !== null && _a !== void 0 ? _a : 2));
        counts[i] = Math.floor(total / (every + 1));
        assigned += counts[i];
    }
    const remaining = total - assigned;
    const weighted = pool.filter(i => { var _a; return ((_a = slots[i].qtyOverride) !== null && _a !== void 0 ? _a : 0) > 0; });
    if (pool.length === 0) {
        return counts;
    }
    if (weighted.length > 0) {
        const wSum = weighted.reduce((sum, i) => { var _a; return sum + ((_a = slots[i].qtyOverride) !== null && _a !== void 0 ? _a : 0); }, 0);
        let weightedAssigned = 0;
        for (const i of weighted) {
            counts[i] = Math.floor((remaining * ((_b = slots[i].qtyOverride) !== null && _b !== void 0 ? _b : 0)) / wSum);
            weightedAssigned += counts[i];
        }
        counts[weighted[0]] += remaining - weightedAssigned; // 余数给第一个有权重槽位
    }
    else {
        const base = Math.floor(remaining / pool.length);
        for (const i of pool) {
            counts[i] = base;
        }
        counts[pool[0]] += remaining - base * pool.length; // 余数给第一个槽位
    }
    return counts;
}
/** 槽位轮转铺满：每轮取一个仍有余量的槽位 */
function interleave(counts) {
    const order = [];
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
function generateSequence(slots, mode, total, rng = Math.random) {
    if (total <= 0 || slots.length === 0) {
        return [];
    }
    const counts = allocateCounts(slots, total);
    const ids = slots.map(s => { var _a; return (_a = s.materialId) !== null && _a !== void 0 ? _a : ''; });
    let order;
    if (mode === 'alternate') {
        order = interleave(counts);
    }
    else if (mode === 'random') {
        const pool = [];
        counts.forEach((c, i) => {
            for (let k = 0; k < c; k++)
                pool.push(i);
        });
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        order = pool;
    }
    else {
        order = [];
        counts.forEach((c, i) => {
            for (let k = 0; k < c; k++)
                order.push(i);
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
function sequenceGeometry(sequence, materials, gap, wristSize, ease = 15, decorSlots = []) {
    var _a;
    const byId = new Map(materials.map(m => [m.id, m]));
    const decorIds = new Set(decorSlots.map(s => s.materialId).filter((id) => id != null));
    const ring = sequence
        .filter(id => !decorIds.has(id))
        .map(id => byId.get(id))
        .filter((m) => m != null);
    if (ring.length === 0) {
        return { calc: null, bom: { items: [], totalCount: 0, totalAmount: 0, cord: null, geometry: null } };
    }
    const count = ring.length;
    const centerCircumference = ring.reduce((sum, m) => { var _a, _b; return sum + ((_b = (_a = m.axialLength) !== null && _a !== void 0 ? _a : m.diameter) !== null && _b !== void 0 ? _b : 8) + gap; }, 0);
    const pitchAvg = centerCircumference / count;
    const dAvg = ring.reduce((sum, m) => { var _a, _b; return sum + ((_b = (_a = m.diameter) !== null && _a !== void 0 ? _a : m.axialLength) !== null && _b !== void 0 ? _b : 8); }, 0) / count;
    const innerCircumference = count >= 2 ? (0, bracelet_1.innerCircOf)(count, pitchAvg, dAvg) : 0;
    const clearance = innerCircumference - wristSize;
    const feedback = (0, bracelet_1.feedbackOf)(clearance);
    const adjustHint = [];
    if (count + 1 <= bracelet_1.MAX_COUNT) {
        adjustHint.push({ delta: 1, feedback: (0, bracelet_1.feedbackOf)((0, bracelet_1.innerCircOf)(count + 1, pitchAvg, dAvg) - wristSize) });
    }
    if (count - 1 >= bracelet_1.MIN_COUNT) {
        adjustHint.push({ delta: -1, feedback: (0, bracelet_1.feedbackOf)((0, bracelet_1.innerCircOf)(count - 1, pitchAvg, dAvg) - wristSize) });
    }
    // 配线：按环上最小孔径选线径
    const holes = ring.map(m => m.holeSize).filter((h) => h != null);
    const holeMin = holes.length ? Math.min(...holes) : null;
    const cordDiameter = (0, shared_1.pickCordDiameter)(holeMin);
    // BOM：环上素材按 materialId 聚合 + decor 槽位计价行（decor 不影响几何）
    const items = ring.map(m => (0, shared_1.bomItem)(m, 1));
    for (const slot of decorSlots) {
        const m = slot.materialId ? byId.get(slot.materialId) : undefined;
        if (m) {
            items.push((0, shared_1.bomItem)(m, Math.max(1, (_a = slot.qtyOverride) !== null && _a !== void 0 ? _a : 1)));
        }
    }
    const aggregated = (0, shared_1.aggregate)(items);
    const cordLength = centerCircumference + shared_1.CORD_TAIL;
    const calc = {
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
    const bom = {
        items: aggregated,
        totalCount: aggregated.reduce((s, i) => s + i.qty, 0),
        totalAmount: aggregated.reduce((s, i) => s + i.subtotal, 0),
        cord: { length: cordLength, diameter: cordDiameter, note: '弹力线，打结收尾留量 160mm' },
        geometry: { innerCircumference, feedback, clearance },
    };
    return { calc, bom };
}
//# sourceMappingURL=sequence.js.map