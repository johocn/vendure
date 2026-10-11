"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.braceletCalculator = void 0;
const bracelet_1 = require("./bracelet");
/** 弹力线打结收尾留量（§7.6） */
const CORD_TAIL = 160;
/** 线径可选档（mm），按最小孔径从大到小取 */
const CORD_DIAMETERS = [1.0, 0.8, 0.6];
function byRole(slots, role) {
    return slots.find(s => s.role === role);
}
function specOf(m) {
    return m.diameter != null ? `${m.diameter}mm ${m.shape}` : m.shape;
}
function bomItem(m, qty) {
    return {
        materialId: m.id,
        code: m.code,
        name: m.name,
        spec: specOf(m),
        unitPrice: m.price,
        qty,
        subtotal: qty * m.price,
    };
}
function aggregate(items) {
    const map = new Map();
    for (const item of items) {
        const existing = map.get(item.materialId);
        if (existing) {
            existing.qty += item.qty;
            existing.subtotal += item.subtotal;
        }
        else {
            map.set(item.materialId, Object.assign({}, item));
        }
    }
    return [...map.values()];
}
function pickCordDiameter(holeMin) {
    var _a;
    if (holeMin == null) {
        return 1.0;
    }
    const max = Math.min(holeMin - 0.2, 1.0);
    return (_a = CORD_DIAMETERS.find(d => d <= max)) !== null && _a !== void 0 ? _a : 0.6;
}
/**
 * 手串计算器（key: 'bracelet'）。
 * - 主珠缺失 → 空 BOM（纯函数不抛错，C 端演示热路径安全）
 * - 焦点珠/隔片按 §7.3 二次收敛：先把 k·(ts+gap) 与焦点珠角从可用周长扣掉再算配珠，≤3 轮
 * - 混合组成的几何展示值用颗数加权平均 pitch/d 套正多边形公式（近似；BOM 与计价不受影响）
 */
const braceletCalculator = (input) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const mainSel = byRole(input.slots, 'main');
    const byId = new Map(input.materials.map(m => [m.id, m]));
    const main = (mainSel === null || mainSel === void 0 ? void 0 : mainSel.materialId) ? byId.get(mainSel.materialId) : undefined;
    if (!main) {
        return { calc: null, bom: { items: [], totalCount: 0, totalAmount: 0, cord: null, geometry: null } };
    }
    const W = Number((_a = input.params.wristSize) !== null && _a !== void 0 ? _a : 155);
    const fit = String((_b = input.params.fit) !== null && _b !== void 0 ? _b : 'comfortable');
    const gap = Number((_c = input.params.gap) !== null && _c !== void 0 ? _c : 0.5);
    const ease = (0, bracelet_1.easeOf)(fit);
    const focalSel = byRole(input.slots, 'focal');
    const focal = (focalSel === null || focalSel === void 0 ? void 0 : focalSel.materialId) ? byId.get(focalSel.materialId) : undefined;
    const spacerSel = byRole(input.slots, 'spacer');
    const spacer = (spacerSel === null || spacerSel === void 0 ? void 0 : spacerSel.materialId) ? byId.get(spacerSel.materialId) : undefined;
    const every = Math.max(1, Math.floor((_d = spacerSel === null || spacerSel === void 0 ? void 0 : spacerSel.every) !== null && _d !== void 0 ? _d : 2));
    const dMain = (_f = (_e = main.diameter) !== null && _e !== void 0 ? _e : main.axialLength) !== null && _f !== void 0 ? _f : 8;
    const tMain = (_g = main.axialLength) !== null && _g !== void 0 ? _g : dMain;
    const geo = (0, bracelet_1.computeBraceletGeometry)({ wristSize: W, diameter: dMain, axialLength: tMain, gap, ease });
    // §7.3 二次收敛（≤3 轮）
    const LCenter = W + ease + Math.PI * dMain;
    const RTarget = LCenter / (2 * Math.PI);
    const tFocal = focal ? (_j = (_h = focal.axialLength) !== null && _h !== void 0 ? _h : focal.diameter) !== null && _j !== void 0 ? _j : 12 : 0;
    const tSpacer = spacer ? (_k = spacer.axialLength) !== null && _k !== void 0 ? _k : 2 : 0;
    let total = geo.count;
    let mainQty = total;
    let spacerQty = 0;
    // 纯主珠直接采用 §7.2 收敛值；二次收敛只针对焦点珠/隔片混合组成（重算会退回 countInitial、丢掉收敛）
    if (focal || spacer) {
        for (let round = 0; round < 3; round++) {
            spacerQty = spacer ? Math.floor(total / (every + 1)) : 0;
            let used = spacerQty * (0, bracelet_1.angleOf)(tSpacer + gap, RTarget);
            if (focal) {
                used += (0, bracelet_1.angleOf)(tFocal + gap, RTarget);
            }
            const thetaMain = (0, bracelet_1.angleOf)(tMain + gap, RTarget);
            mainQty = Math.max(0, Math.floor((2 * Math.PI - used) / thetaMain));
            const next = mainQty + (focal ? 1 : 0) + spacerQty;
            if (next === total) {
                break;
            }
            total = next;
        }
    }
    // 混合组成的几何展示值（加权平均近似）
    const dFocal = focal ? (_l = focal.diameter) !== null && _l !== void 0 ? _l : 12 : 0;
    const dSpacer = spacer ? (_m = spacer.diameter) !== null && _m !== void 0 ? _m : 6 : 0;
    const pitchAvg = total > 0
        ? (mainQty * (tMain + gap) + (focal ? tFocal + gap : 0) + spacerQty * (tSpacer + gap)) / total
        : tMain + gap;
    const dAvg = total > 0
        ? (mainQty * dMain + (focal ? dFocal : 0) + spacerQty * dSpacer) / total
        : dMain;
    const innerCircumference = total >= 2 ? (0, bracelet_1.innerCircOf)(total, pitchAvg, dAvg) : 0;
    const clearance = innerCircumference - W;
    const centerCircumference = total >= 2 ? (Math.PI * pitchAvg) / Math.sin(Math.PI / total) : LCenter;
    // BOM（按素材聚合，金额分整数）
    const items = [];
    if (mainQty > 0) {
        items.push(bomItem(main, mainQty));
    }
    if (focal) {
        items.push(bomItem(focal, 1));
    }
    if (spacer && spacerQty > 0) {
        items.push(bomItem(spacer, spacerQty));
    }
    const aggregated = aggregate(items);
    const holes = items
        .map(i => { var _a; return (_a = byId.get(i.materialId)) === null || _a === void 0 ? void 0 : _a.holeSize; })
        .filter((h) => h != null);
    const holeMin = holes.length ? Math.min(...holes) : null;
    const cordDiameter = pickCordDiameter(holeMin);
    const calc = {
        count: total,
        countInitial: geo.countInitial,
        centerCircumference,
        innerCircumference,
        feedback: (0, bracelet_1.feedbackOf)(clearance),
        clearance,
        adjustHint: geo.adjustHint,
        cordLength: centerCircumference + CORD_TAIL,
        cordDiameter,
    };
    const bom = {
        items: aggregated,
        totalCount: aggregated.reduce((s, i) => s + i.qty, 0),
        totalAmount: aggregated.reduce((s, i) => s + i.subtotal, 0),
        cord: aggregated.length ? { length: calc.cordLength, diameter: cordDiameter, note: '弹力线，打结收尾留量 160mm' } : null,
        geometry: aggregated.length ? { innerCircumference, feedback: calc.feedback, clearance } : null,
    };
    return { calc, bom };
};
exports.braceletCalculator = braceletCalculator;
//# sourceMappingURL=bracelet-calculator.js.map