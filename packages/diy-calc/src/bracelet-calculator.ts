import { angleOf, computeBraceletGeometry, easeOf, feedbackOf, innerCircOf } from './bracelet';
import { aggregate, bomItem, CORD_TAIL, pickCordDiameter } from './shared';
import { CalcBom, CalcBomItem, CalcMaterial, Calculator, CalculatorInput, CalcResult, SlotSelection } from './types';

function byRole(slots: SlotSelection[], role: SlotSelection['role']): SlotSelection | undefined {
    return slots.find(s => s.role === role);
}

/** 各角色素材的几何口径（回退默认值沿用 v1：主珠 8 / 焦点 12 / 隔片 2） */
function axialOf(m: CalcMaterial, role: 'main' | 'focal' | 'spacer'): number {
    if (role === 'main') {
        return m.axialLength ?? m.diameter ?? 8;
    }
    if (role === 'focal') {
        return m.axialLength ?? m.diameter ?? 12;
    }
    return m.axialLength ?? 2;
}

function diamOf(m: CalcMaterial, role: 'main' | 'focal' | 'spacer'): number {
    if (role === 'main') {
        return m.diameter ?? m.axialLength ?? 8;
    }
    if (role === 'focal') {
        return m.diameter ?? 12;
    }
    return m.diameter ?? 6;
}

function everyOf(sel: SlotSelection | undefined): number {
    return Math.max(1, Math.floor(sel?.every ?? 2));
}

/** 配线孔径取环上素材最小孔径（decor 不参与） */
function ringCordDiameter(items: CalcBomItem[], byId: Map<string, CalcMaterial>): number {
    const holes = items.map(i => byId.get(i.materialId)?.holeSize).filter((h): h is number => h != null);
    const holeMin = holes.length ? Math.min(...holes) : null;
    return pickCordDiameter(holeMin);
}

/** 追加 decor 只计价行（qty = max(1, qtyOverride ?? 1)）后按素材聚合 */
function assembleBom(
    items: CalcBomItem[],
    decorSels: SlotSelection[],
    byId: Map<string, CalcMaterial>,
    cordDiameter: number,
    calc: CalcResult,
    innerCircumference: number,
): CalcBom {
    for (const sel of decorSels) {
        const m = sel.materialId ? byId.get(sel.materialId) : undefined;
        if (m) {
            items.push(bomItem(m, Math.max(1, sel.qtyOverride ?? 1)));
        }
    }
    const aggregated = aggregate(items);
    return {
        items: aggregated,
        totalCount: aggregated.reduce((s, i) => s + i.qty, 0),
        totalAmount: aggregated.reduce((s, i) => s + i.subtotal, 0),
        cord: aggregated.length ? { length: calc.cordLength, diameter: cordDiameter, note: '弹力线，打结收尾留量 160mm' } : null,
        geometry: aggregated.length ? { innerCircumference, feedback: calc.feedback, clearance: calc.clearance } : null,
    };
}

interface BraceletArgs {
    /** wristSize */
    W: number;
    gap: number;
    ease: number;
    /** decor 槽位：只计价，不进几何/颗数/配线孔径 */
    decorSels: SlotSelection[];
    byId: Map<string, CalcMaterial>;
}

/**
 * v1 兼容路径：单 main + 至多单 spacer/focal，数值与 v1 完全一致。
 * - 纯主珠直接采用 §7.2 收敛值；焦点珠/隔片按 §7.3 二次收敛（≤3 轮）
 * - 混合组成的几何展示值用颗数加权平均 pitch/d 套正多边形公式（近似；BOM 与计价不受影响）
 */
function braceletV1(args: BraceletArgs & {
    main: CalcMaterial;
    spacer: CalcMaterial | undefined;
    every: number;
    focal: CalcMaterial | undefined;
}): { calc: CalcResult; bom: CalcBom } {
    const { W, gap, ease, main, spacer, every, focal, decorSels, byId } = args;

    const dMain = main.diameter ?? main.axialLength ?? 8;
    const tMain = main.axialLength ?? dMain;
    const geo = computeBraceletGeometry({ wristSize: W, diameter: dMain, axialLength: tMain, gap, ease });

    // §7.3 二次收敛（≤3 轮）
    const LCenter = W + ease + Math.PI * dMain;
    const RTarget = LCenter / (2 * Math.PI);
    const tFocal = focal ? focal.axialLength ?? focal.diameter ?? 12 : 0;
    const tSpacer = spacer ? spacer.axialLength ?? 2 : 0;
    let total = geo.count;
    let mainQty = total;
    let spacerQty = 0;
    // 纯主珠直接采用 §7.2 收敛值；二次收敛只针对焦点珠/隔片混合组成（重算会退回 countInitial、丢掉收敛）
    if (focal || spacer) {
        for (let round = 0; round < 3; round++) {
            spacerQty = spacer ? Math.floor(total / (every + 1)) : 0;
            let used = spacerQty * angleOf(tSpacer + gap, RTarget);
            if (focal) {
                used += angleOf(tFocal + gap, RTarget);
            }
            const thetaMain = angleOf(tMain + gap, RTarget);
            mainQty = Math.max(0, Math.floor((2 * Math.PI - used) / thetaMain));
            const next = mainQty + (focal ? 1 : 0) + spacerQty;
            if (next === total) {
                break;
            }
            total = next;
        }
    }

    // 混合组成的几何展示值（加权平均近似）
    const dFocal = focal ? focal.diameter ?? 12 : 0;
    const dSpacer = spacer ? spacer.diameter ?? 6 : 0;
    const pitchAvg =
        total > 0
            ? (mainQty * (tMain + gap) + (focal ? tFocal + gap : 0) + spacerQty * (tSpacer + gap)) / total
            : tMain + gap;
    const dAvg =
        total > 0
            ? (mainQty * dMain + (focal ? dFocal : 0) + spacerQty * dSpacer) / total
            : dMain;
    const innerCircumference = total >= 2 ? innerCircOf(total, pitchAvg, dAvg) : 0;
    const clearance = innerCircumference - W;
    const centerCircumference = total >= 2 ? (Math.PI * pitchAvg) / Math.sin(Math.PI / total) : LCenter;

    // BOM（按素材聚合，金额分整数；decor 行在配线孔径计算之后追加）
    const items: CalcBomItem[] = [];
    if (mainQty > 0) {
        items.push(bomItem(main, mainQty));
    }
    if (focal) {
        items.push(bomItem(focal, 1));
    }
    if (spacer && spacerQty > 0) {
        items.push(bomItem(spacer, spacerQty));
    }
    const calc: CalcResult = {
        count: total,
        countInitial: geo.countInitial,
        centerCircumference,
        innerCircumference,
        feedback: feedbackOf(clearance),
        clearance,
        adjustHint: geo.adjustHint,
        cordLength: centerCircumference + CORD_TAIL,
        cordDiameter: ringCordDiameter(items, byId),
    };
    return { calc, bom: assembleBom(items, decorSels, byId, calc.cordDiameter, calc, innerCircumference) };
}

/**
 * v2 多素材路径：多主珠 / 多隔片槽位。
 * - 固定颗数模式：所有 main 槽位都带 qtyOverride → 各 main 数量 = qtyOverride，
 *   spacer 数量 = qtyOverride ?? floor(主珠+焦点总数/(every+1))，total = Σ 各槽位
 * - 定手围收敛模式（默认）：权重 w = qtyOverride ?? 1，dMainAvg 加权平均定初值；
 *   纯主珠直接用 §7.2 收敛值，焦点珠/隔片混合组成做 ≤3 轮二次收敛：
 *   mainCounts_i = floor(total·w_i/Σw)（余数给权重最大者）、spacerCounts_j = floor(total/(every_j+1))、
 *   perAvg = used/total、next = max(1, floor(2π/perAvg))
 * - 收敛取整是近似：qtyOverride 权重只保证配比方向与量级，不保证精确比例
 */
function braceletV2(args: BraceletArgs & {
    mains: Array<{ sel: SlotSelection; m: CalcMaterial }>;
    spacers: Array<{ sel: SlotSelection; m: CalcMaterial }>;
    focal: CalcMaterial | undefined;
}): { calc: CalcResult; bom: CalcBom } {
    const { W, gap, ease, mains, spacers, focal, decorSels, byId } = args;
    const tFocal = focal ? focal.axialLength ?? focal.diameter ?? 12 : 0;
    const dFocal = focal ? focal.diameter ?? 12 : 0;
    const focalCount = focal ? 1 : 0;

    // 主珠加权平均（权重 = qtyOverride ?? 1；全零权重兜底为等权，防 NaN）
    const weights = mains.map(x => x.sel.qtyOverride ?? 1);
    let wSum = weights.reduce((s, w) => s + w, 0);
    if (wSum <= 0) {
        weights.fill(1);
        wSum = weights.length;
    }
    const dMainAvg = mains.reduce((s, x, i) => s + weights[i] * diamOf(x.m, 'main'), 0) / wSum;
    const geo = computeBraceletGeometry({ wristSize: W, diameter: dMainAvg, axialLength: dMainAvg, gap, ease });
    const LCenter = W + ease + Math.PI * dMainAvg;
    const RTarget = LCenter / (2 * Math.PI);

    /** 按权重把 total 颗分到各 main 槽位，余数给权重最大者（并列取先） */
    const splitByWeight = (total: number): number[] => {
        const counts = mains.map((_, i) => Math.floor((total * weights[i]) / wSum));
        const rem = total - counts.reduce((s, c) => s + c, 0);
        if (rem > 0) {
            let maxIdx = 0;
            for (let i = 1; i < weights.length; i++) {
                if (weights[i] > weights[maxIdx]) {
                    maxIdx = i;
                }
            }
            counts[maxIdx] += rem;
        }
        return counts;
    };

    let mainCounts: number[] = [];
    let spacerCounts: number[] = [];
    let totalCount: number;

    const allFixed = mains.every(x => x.sel.qtyOverride != null);
    if (allFixed) {
        // 固定颗数模式：main 数量 = qtyOverride；spacer 数量 = qtyOverride ?? floor(主珠+焦点总数/(every+1))
        mainCounts = mains.map(x => Math.max(0, Math.floor(x.sel.qtyOverride ?? 0)));
        const base = mainCounts.reduce((s, c) => s + c, 0) + focalCount;
        spacerCounts = spacers.map(x =>
            x.sel.qtyOverride != null ? Math.max(0, Math.floor(x.sel.qtyOverride)) : Math.floor(base / (everyOf(x.sel) + 1)),
        );
        totalCount = base + spacerCounts.reduce((s, c) => s + c, 0);
    } else {
        const total0 = geo.count;
        if (focal || spacers.length > 0) {
            let total = total0;
            for (let round = 0; round < 3; round++) {
                mainCounts = splitByWeight(total);
                spacerCounts = spacers.map(x => Math.floor(total / (everyOf(x.sel) + 1)));
                let used = 0;
                mains.forEach((x, i) => {
                    used += mainCounts[i] * angleOf(axialOf(x.m, 'main') + gap, RTarget);
                });
                spacers.forEach((x, i) => {
                    used += spacerCounts[i] * angleOf(axialOf(x.m, 'spacer') + gap, RTarget);
                });
                if (focal) {
                    used += angleOf(tFocal + gap, RTarget);
                }
                const perAvg = used / total;
                const next = perAvg > 0 ? Math.max(1, Math.floor((2 * Math.PI) / perAvg)) : total;
                if (next === total) {
                    break;
                }
                total = next;
            }
        } else {
            mainCounts = splitByWeight(total0);
            spacerCounts = spacers.map(() => 0);
        }
        // 实际环上颗数 = 各槽位数量之和（与 BOM 自洽；收敛取整后可与迭代 total 略有出入）
        totalCount = mainCounts.reduce((s, c) => s + c, 0) + spacerCounts.reduce((s, c) => s + c, 0) + focalCount;
    }

    // 几何展示值：对环上全部珠做加权平均 pitch/d 套正多边形公式（与 v1 口径一致）
    const ringPitchSum =
        mains.reduce((s, x, i) => s + mainCounts[i] * (axialOf(x.m, 'main') + gap), 0) +
        spacers.reduce((s, x, i) => s + spacerCounts[i] * (axialOf(x.m, 'spacer') + gap), 0) +
        (focal ? tFocal + gap : 0);
    const ringDiamSum =
        mains.reduce((s, x, i) => s + mainCounts[i] * diamOf(x.m, 'main'), 0) +
        spacers.reduce((s, x, i) => s + spacerCounts[i] * diamOf(x.m, 'spacer'), 0) +
        (focal ? dFocal : 0);
    const pitchAvg = totalCount > 0 ? ringPitchSum / totalCount : dMainAvg;
    const dAvg = totalCount > 0 ? ringDiamSum / totalCount : dMainAvg;
    const innerCircumference = totalCount >= 2 ? innerCircOf(totalCount, pitchAvg, dAvg) : 0;
    const clearance = innerCircumference - W;
    const centerCircumference = totalCount >= 2 ? (Math.PI * pitchAvg) / Math.sin(Math.PI / totalCount) : LCenter;

    // BOM（环上各行 qty>0 + decor 只计价行，decor 行在配线孔径计算之后追加）
    const items: CalcBomItem[] = [];
    mains.forEach((x, i) => {
        if (mainCounts[i] > 0) {
            items.push(bomItem(x.m, mainCounts[i]));
        }
    });
    if (focal) {
        items.push(bomItem(focal, 1));
    }
    spacers.forEach((x, i) => {
        if (spacerCounts[i] > 0) {
            items.push(bomItem(x.m, spacerCounts[i]));
        }
    });
    const calc: CalcResult = {
        count: totalCount,
        countInitial: geo.countInitial,
        centerCircumference,
        innerCircumference,
        feedback: feedbackOf(clearance),
        clearance,
        adjustHint: geo.adjustHint,
        cordLength: centerCircumference + CORD_TAIL,
        cordDiameter: ringCordDiameter(items, byId),
    };
    return { calc, bom: assembleBom(items, decorSels, byId, calc.cordDiameter, calc, innerCircumference) };
}

/**
 * 手串计算器 v2（key: 'bracelet'）。
 * - 主珠缺失 → 空 BOM（纯函数不抛错，C 端演示热路径安全）
 * - v1 形状（单 main + 至多单 spacer/focal，且 main/spacer 槽位未用 qtyOverride）走 v1 原路径，数值零回归
 * - v2 多素材路径：多主珠/多隔片、qtyOverride 定颗数或作收敛权重、decor 只计价
 */
export const braceletCalculator: Calculator = (input: CalculatorInput) => {
    const byId = new Map(input.materials.map(m => [m.id, m]));
    const W = Number(input.params.wristSize ?? 155);
    const fit = String(input.params.fit ?? 'comfortable');
    const gap = Number(input.params.gap ?? 0.5);
    const ease = easeOf(fit);

    const mainSels = input.slots.filter(s => s.role === 'main' && s.materialId != null && byId.has(s.materialId));
    if (mainSels.length === 0) {
        return { calc: null, bom: { items: [], totalCount: 0, totalAmount: 0, cord: null, geometry: null } };
    }
    const mains = mainSels.map(sel => ({ sel, m: byId.get(sel.materialId as string) as CalcMaterial }));
    const focalSel = byRole(input.slots, 'focal');
    const focal = focalSel?.materialId ? byId.get(focalSel.materialId) : undefined;
    const spacers = input.slots
        .filter(s => s.role === 'spacer')
        .map(sel => ({ sel, m: sel.materialId ? byId.get(sel.materialId) : undefined }))
        .filter((x): x is { sel: SlotSelection; m: CalcMaterial } => x.m != null);
    const decorSels = input.slots.filter(s => s.role === 'decor');

    // v1 兼容路径：单 main + 至多单 spacer，且 main/spacer 槽位未用 qtyOverride（decor 的 qtyOverride 与几何无关）
    const spacerSels = input.slots.filter(s => s.role === 'spacer');
    const hasQtyOverride = [...mainSels, ...spacerSels].some(s => s.qtyOverride != null);
    if (mains.length === 1 && spacers.length <= 1 && !hasQtyOverride) {
        return braceletV1({
            W,
            gap,
            ease,
            main: mains[0].m,
            spacer: spacers[0]?.m,
            every: everyOf(spacers[0]?.sel),
            focal,
            decorSels,
            byId,
        });
    }
    return braceletV2({ W, gap, ease, mains, spacers, focal, decorSels, byId });
};
