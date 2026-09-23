/**
 * 盘库纯函数层：状态机 / 任务号 / 应盘清单生成 / 差异汇总 / 扫码解析 / 过账计划。
 * 全部无副作用、无 DB，供 service 与单测共用（规格 §6 全部落在这里）。
 */
import type { StocktakeTaskState } from './stocktake-task.entity';
import type { StocktakeScopeType, StocktakeWaveState } from './stocktake-wave.entity';

export type { StocktakeTaskState, StocktakeWaveState, StocktakeScopeType };

export type BinMode = 'off' | 'zone' | 'bin';

export const TASK_STATES: StocktakeTaskState[] = ['DRAFT', 'OPEN', 'COUNTING', 'COUNTED', 'POSTED', 'CANCELLED'];
export const WAVE_STATES: StocktakeWaveState[] = ['OPEN', 'CLAIMED', 'COUNTING', 'SUBMITTED', 'CANCELLED'];

const TASK_EDGES: Record<StocktakeTaskState, StocktakeTaskState[]> = {
    DRAFT: ['OPEN', 'CANCELLED'],
    OPEN: ['COUNTING', 'COUNTED', 'CANCELLED'],
    COUNTING: ['COUNTED', 'CANCELLED'],
    COUNTED: ['POSTED', 'CANCELLED'],
    POSTED: [],
    CANCELLED: [],
};

const WAVE_EDGES: Record<StocktakeWaveState, StocktakeWaveState[]> = {
    OPEN: ['CLAIMED', 'CANCELLED'],
    CLAIMED: ['COUNTING', 'OPEN', 'CANCELLED'],   // → OPEN 即「释放」（清空负责人）
    COUNTING: ['SUBMITTED', 'OPEN', 'CANCELLED'], // → OPEN 即「释放」（清空负责人）
    SUBMITTED: [],
    CANCELLED: [],
};

export function canTaskTransition(from: StocktakeTaskState, to: StocktakeTaskState): boolean {
    return (TASK_EDGES[from] || []).includes(to);
}

export function canWaveTransition(from: StocktakeWaveState, to: StocktakeWaveState): boolean {
    return (WAVE_EDGES[from] || []).includes(to);
}

/** 任务号：TK + yyyymmdd + 三位流水 */
export function formatTaskCode(now: Date, seq: number): string {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `TK${y}${m}${d}-${String(seq).padStart(3, '0')}`;
}

/** 从既有任务号里取当日最大流水 +1（跨渠道各算各的，调用方传入本渠道的号） */
export function nextTaskSeq(codes: string[], now: Date): number {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const prefix = `TK${y}${m}${d}-`;
    let max = 0;
    for (const code of codes) {
        if (!code || !code.startsWith(prefix)) continue;
        const n = Number.parseInt(code.slice(prefix.length), 10);
        if (Number.isFinite(n) && n > max) max = n;
    }
    return max + 1;
}

// ---------------------------------------------------------------- 应盘清单

export interface StocktakeScope {
    /** 限定盘次集合（库区 id）；空数组 = 全部库区 */
    zones: number[];
    /** 分类限定；**由 service 先解析成 variantIds 再合并进 variantIds**，纯函数不碰商品数据 */
    categoryIds: number[];
    /** 限定变体集合（专项盘）；空数组 = 不限 */
    variantIds: number[];
    includeZeroBook: boolean;
}

export interface BookRow { variantId: number; quantity: number; }
export interface BindRow { variantId: number; zoneId: number; binId: number | null; zoneCode?: string | null; binCode?: string | null; }
export interface VariantMeta { sku: string; name: string; }
export interface ZoneMeta { code: string; name: string; }

export interface ExpectedLine {
    variantId: number;
    variantSku: string;
    variantName: string;
    zoneId: number | null;
    binId: number | null;
    zoneCode: string | null;
    binCode: string | null;
    bookQty: number;
}

export interface ExpectedWave {
    scopeType: StocktakeScopeType;
    zoneId: number | null;
    zoneCode: string | null;
    zoneName: string | null;
    expectedCount: number;
}

export interface BuildExpectedInput {
    binMode: BinMode;
    bookRows: BookRow[];
    bindRows: BindRow[];
    variantMeta: Map<number, VariantMeta>;
    zoneMeta: Map<number, ZoneMeta>;
    scope: StocktakeScope;
}

export interface BuildExpectedResult {
    waves: ExpectedWave[];
    /** 与 waves 同序同长：linesByWave[i] 属于 waves[i] */
    linesByWave: ExpectedLine[][];
}

/**
 * 应盘清单 = 已归位 ∪ 有账面（规格 §3.4/§6.1）。
 * - bookRows 先按 variantId 归并求和（同变体多库存行）
 * - 有绑定 → 每个 (zoneId, binId) 一行；无绑定 → 未归位桶
 * - scope.zones 之外的绑定 → 也退入未归位桶（**不丢行**）
 * - binMode=off → 只建一个 whole 盘次，库位一律为空
 */
export function buildExpected(input: BuildExpectedInput): BuildExpectedResult {
    const { binMode, bookRows, bindRows, variantMeta, zoneMeta, scope } = input;

    const book = new Map<number, number>();
    for (const r of bookRows) {
        book.set(r.variantId, (book.get(r.variantId) || 0) + (r.quantity || 0));
    }
    if (!scope.includeZeroBook) {
        for (const [variantId, qty] of Array.from(book.entries())) {
            if (qty <= 0) book.delete(variantId);
        }
    }

    const bindByVariant = new Map<number, BindRow[]>();
    for (const b of bindRows) {
        const list = bindByVariant.get(b.variantId) || [];
        list.push(b);
        bindByVariant.set(b.variantId, list);
    }

    const scopeVariants = scope.variantIds.length ? new Set(scope.variantIds) : null;
    const scopeZones = scope.zones.length ? new Set(scope.zones) : null;

    const candidates = new Set<number>([...book.keys(), ...bindByVariant.keys()]);
    const meta = (variantId: number): VariantMeta => variantMeta.get(variantId) || { sku: `#${variantId}`, name: '' };
    const bookOf = (variantId: number) => book.get(variantId) || 0;

    // waveKey: 'zone:{id}' | 'unassigned' | 'whole'
    const groups = new Map<string, { wave: ExpectedWave; lines: ExpectedLine[] }>();

    const ensureGroup = (key: string, make: () => ExpectedWave) => {
        let g = groups.get(key);
        if (!g) {
            g = { wave: make(), lines: [] };
            groups.set(key, g);
        }
        return g;
    };

    for (const variantId of Array.from(candidates).sort((a, b) => a - b)) {
        if (scopeVariants && !scopeVariants.has(variantId)) continue;
        const m = meta(variantId);
        const bookQty = bookOf(variantId);
        const binds = (bindByVariant.get(variantId) || []).filter((b) => !scopeZones || scopeZones.has(b.zoneId));

        if (binMode === 'off') {
            const g = ensureGroup('whole', () => ({
                scopeType: 'whole', zoneId: null, zoneCode: null, zoneName: null, expectedCount: 0,
            }));
            g.lines.push({
                variantId, variantSku: m.sku, variantName: m.name,
                zoneId: null, binId: null, zoneCode: null, binCode: null, bookQty,
            });
            continue;
        }

        if (!binds.length) {
            const g = ensureGroup('unassigned', () => ({
                scopeType: 'unassigned', zoneId: null, zoneCode: null, zoneName: null, expectedCount: 0,
            }));
            g.lines.push({
                variantId, variantSku: m.sku, variantName: m.name,
                zoneId: null, binId: null, zoneCode: null, binCode: null, bookQty,
            });
            continue;
        }

        for (const b of binds) {
            const zm = zoneMeta.get(b.zoneId);
            const g = ensureGroup(`zone:${b.zoneId}`, () => ({
                scopeType: 'zone',
                zoneId: b.zoneId,
                zoneCode: b.zoneCode ?? zm?.code ?? null,
                zoneName: zm?.name ?? null,
                expectedCount: 0,
            }));
            g.lines.push({
                variantId, variantSku: m.sku, variantName: m.name,
                zoneId: b.zoneId, binId: b.binId,
                zoneCode: b.zoneCode ?? zm?.code ?? null, binCode: b.binCode ?? null,
                bookQty,
            });
        }
    }

    const keys = Array.from(groups.keys()).sort((a, b) => {
        const rank = (k: string) => (k === 'whole' ? 0 : k === 'unassigned' ? 2 : 1);
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;
        const na = Number(a.split(':')[1] || 0);
        const nb = Number(b.split(':')[1] || 0);
        return na - nb;
    });

    const waves: ExpectedWave[] = [];
    const linesByWave: ExpectedLine[][] = [];
    for (const key of keys) {
        const g = groups.get(key)!;
        g.wave.expectedCount = g.lines.length;
        waves.push(g.wave);
        linesByWave.push(g.lines);
    }
    return { waves, linesByWave };
}

// ---------------------------------------------------------------- 差异汇总

export interface VarianceInputLine {
    id: number;
    variantId: number;
    countedQty: number | null;
    isExtra: boolean;
    bookQty: number;
    zoneId: number | null;
    binId: number | null;
}

export interface VariantVariance {
    variantId: number;
    countedTotal: number;
    bookQty: number;
    snapBookQty: number;
    diff: number;
    isExtra: boolean;
    binChanged: boolean;
    targetZoneId: number | null;
    targetBinId: number | null;
}

export interface VarianceSummary {
    expectedTotal: number;
    countedLineCount: number;
    uncountedCount: number;
    extraCount: number;
    byVariant: VariantVariance[];
    uncountedLineIds: number[];
    extraLineIds: number[];
    changedVariants: { variantId: number; snapBookQty: number; currentBookQty: number }[];
    recheck: boolean;
}

/** 非盘盈行的账面快照（同变体各行相同，取首个） */
export function variantSnapBook(lines: VarianceInputLine[]): Map<number, number> {
    const m = new Map<number, number>();
    for (const l of lines) {
        if (l.isExtra) continue;
        if (!m.has(l.variantId)) m.set(l.variantId, l.bookQty);
    }
    return m;
}

/**
 * 差异汇总（规格 §6.2）：**以变体为最小比对单位**。
 * 实盘合计 = SUM(countedQty)（含盘盈行，未盘行不计入）；盈亏 = 实盘合计 - 当前账面。
 */
export function summarizeVariance(
    lines: VarianceInputLine[],
    currentBook: BookRow[],
    currentBind: BindRow[],
): VarianceSummary {
    const bookMap = new Map<number, number>();
    for (const r of currentBook) bookMap.set(r.variantId, (bookMap.get(r.variantId) || 0) + (r.quantity || 0));
    const bindMap = new Map<number, BindRow>();
    for (const b of currentBind) bindMap.set(b.variantId, b);
    const snap = variantSnapBook(lines);

    const grouped = new Map<number, VarianceInputLine[]>();
    for (const l of lines) {
        const list = grouped.get(l.variantId) || [];
        list.push(l);
        grouped.set(l.variantId, list);
    }

    const uncountedLineIds: number[] = [];
    const extraLineIds: number[] = [];
    const byVariant: VariantVariance[] = [];
    const changedVariants: VarianceSummary['changedVariants'] = [];

    for (const l of lines) {
        if (l.isExtra) extraLineIds.push(l.id);
        else if (l.countedQty === null) uncountedLineIds.push(l.id);
    }

    for (const variantId of Array.from(grouped.keys()).sort((a, b) => a - b)) {
        const rows = grouped.get(variantId)!;
        const countedTotal = rows.reduce((s, l) => s + (l.countedQty === null ? 0 : l.countedQty), 0);
        const currentBookQty = bookMap.get(variantId) || 0;
        const snapBookQty = snap.get(variantId) || 0;
        const diff = countedTotal - currentBookQty;

        // 目标库位 = 最后一条「已盘且带库位」的行
        const located = rows.filter((l) => l.countedQty !== null && (l.zoneId !== null || l.binId !== null));
        const target = located.length ? located[located.length - 1] : null;
        const cur = bindMap.get(variantId) || null;
        const binChanged = !!target && (
            !cur ||
            (cur.zoneId ?? null) !== (target.zoneId ?? null) ||
            (cur.binId ?? null) !== (target.binId ?? null)
        );

        const isExtra = rows.every((l) => l.isExtra);
        if (diff !== 0 || binChanged || isExtra) {
            byVariant.push({
                variantId, countedTotal, bookQty: currentBookQty, snapBookQty, diff, isExtra, binChanged,
                targetZoneId: target ? target.zoneId ?? null : null,
                targetBinId: target ? target.binId ?? null : null,
            });
        }
        if (currentBookQty !== snapBookQty) {
            changedVariants.push({ variantId, snapBookQty, currentBookQty });
        }
    }

    return {
        expectedTotal: lines.filter((l) => !l.isExtra).length,
        countedLineCount: lines.filter((l) => !l.isExtra && l.countedQty !== null).length,
        uncountedCount: uncountedLineIds.length,
        extraCount: extraLineIds.length,
        byVariant,
        uncountedLineIds,
        extraLineIds,
        changedVariants,
        recheck: changedVariants.length > 0,
    };
}

// ---------------------------------------------------------------- 过账计划

export interface PostPlanItem {
    variantId: number;
    toStockLocationId: number;
    realQty: number;
    zoneId: number | null;
    binId: number | null;
}

export interface PostPlan { items: PostPlanItem[]; }

/**
 * 过账项（规格 §6.3 步骤 5）：
 * - 有差异 → realQty = 实盘合计
 * - 无差异但库位变更 → realQty = 当前账面（仅触发原地归位，不动数量）
 * - 两者都不是 → 不生成项
 */
export function buildPostItems(input: { summary: VarianceSummary; stockLocationId: number }): PostPlan {
    const { summary, stockLocationId } = input;
    const items: PostPlanItem[] = [];
    for (const v of summary.byVariant) {
        if (v.diff === 0 && !v.binChanged) continue;
        items.push({
            variantId: v.variantId,
            toStockLocationId: stockLocationId,
            realQty: v.diff === 0 ? v.bookQty : v.countedTotal,
            zoneId: v.targetZoneId,
            binId: v.targetBinId,
        });
    }
    return { items };
}

// ---------------------------------------------------------------- 扫码解析

export interface ScanBin { binId: number; binCode: string; zoneId: number; }
export interface ScanLine { lineId: number; variantId: number; sku: string; barcode: string | null; internalCode: string | null; }
export interface ScanVariant { variantId: number; sku: string; barcode: string | null; internalCode: string | null; name?: string; }

export type ScanHit =
    | { kind: 'bin'; binId: number; binCode: string; zoneId: number }
    | { kind: 'line'; lineId: number; variantId: number }
    | { kind: 'extra'; variantId: number; sku: string; name?: string }
    | { kind: 'none'; raw: string };

/**
 * 扫码解析优先级（规格 §8.3）：库位码 → 内部码 → 条形码 → SKU → 未命中。
 * 命中的永远是「任务内应盘行」优先，其次才是清单外变体（避免把清单内变体误登记为盘盈）。
 */
export function resolveScanCode(raw: string, ctx: { bins: ScanBin[]; lines: ScanLine[]; variants: ScanVariant[] }): ScanHit {
    const code = (raw || '').trim();
    if (!code) return { kind: 'none', raw: '' };

    const bin = ctx.bins.find((b) => b.binCode === code);
    if (bin) return { kind: 'bin', binId: bin.binId, binCode: bin.binCode, zoneId: bin.zoneId };

    const hitLine = (v: ScanLine | ScanVariant): boolean => v.internalCode === code || v.barcode === code || v.sku === code;

    const line = ctx.lines.find(hitLine);
    if (line) return { kind: 'line', lineId: line.lineId, variantId: line.variantId };

    const variant = ctx.variants.find(hitLine);
    if (variant) return { kind: 'extra', variantId: variant.variantId, sku: variant.sku, name: variant.name };

    return { kind: 'none', raw: code };
}