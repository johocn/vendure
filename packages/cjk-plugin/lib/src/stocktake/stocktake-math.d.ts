/**
 * 盘库纯函数层：状态机 / 任务号 / 应盘清单生成 / 差异汇总 / 扫码解析 / 过账计划。
 * 全部无副作用、无 DB，供 service 与单测共用（规格 §6 全部落在这里）。
 */
import type { StocktakeTaskState } from './stocktake-task.entity';
import type { StocktakeScopeType, StocktakeWaveState } from './stocktake-wave.entity';
export type { StocktakeTaskState, StocktakeWaveState, StocktakeScopeType };
export type BinMode = 'off' | 'zone' | 'bin';
export declare const TASK_STATES: StocktakeTaskState[];
export declare const WAVE_STATES: StocktakeWaveState[];
export declare function canTaskTransition(from: StocktakeTaskState, to: StocktakeTaskState): boolean;
export declare function canWaveTransition(from: StocktakeWaveState, to: StocktakeWaveState): boolean;
/** 任务号：TK + yyyymmdd + 三位流水 */
export declare function formatTaskCode(now: Date, seq: number): string;
/** 从既有任务号里取当日最大流水 +1（跨渠道各算各的，调用方传入本渠道的号） */
export declare function nextTaskSeq(codes: string[], now: Date): number;
export interface StocktakeScope {
    /** 限定盘次集合（库区 id）；空数组 = 全部库区 */
    zones: number[];
    /** 分类限定；**由 service 先解析成 variantIds 再合并进 variantIds**，纯函数不碰商品数据 */
    categoryIds: number[];
    /** 限定变体集合（专项盘）；空数组 = 不限 */
    variantIds: number[];
    includeZeroBook: boolean;
}
export interface BookRow {
    variantId: number;
    quantity: number;
}
export interface BindRow {
    variantId: number;
    zoneId: number;
    binId: number | null;
    zoneCode?: string | null;
    binCode?: string | null;
}
export interface VariantMeta {
    sku: string;
    name: string;
}
export interface ZoneMeta {
    code: string;
    name: string;
}
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
    /**
     * 建任务开关（`createStocktakeTask.autoSplitByZone`）：false = **不按库区拆盘次**，
     * 整仓只出一个 `whole` 盘次（行仍保留库位归属，录入页网格照常可用）。
     * 缺省 / true = 按库区拆（zone 档/bin 档各库区一个盘次 + 未归位桶）。
     */
    autoSplitByZone?: boolean;
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
 * - autoSplitByZone=false（且 binMode≠off）→ 只建一个 whole 盘次，行保留库位归属
 */
export declare function buildExpected(input: BuildExpectedInput): BuildExpectedResult;
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
    changedVariants: {
        variantId: number;
        snapBookQty: number;
        currentBookQty: number;
    }[];
    recheck: boolean;
}
/** 非盘盈行的账面快照（同变体各行相同，取首个） */
export declare function variantSnapBook(lines: VarianceInputLine[]): Map<number, number>;
/**
 * 差异汇总（规格 §6.2）：**以变体为最小比对单位**。
 * 实盘合计 = SUM(countedQty)（含盘盈行，未盘行不计入）；盈亏 = 实盘合计 - 当前账面。
 * **整变体未盘（该变体所有行 countedQty 均为 null）→ 不进 byVariant（过账时账面保持不变）；
 * 未盘行仍由 uncountedLineIds / uncountedCount 列出。**
 */
export declare function summarizeVariance(lines: VarianceInputLine[], currentBook: BookRow[], currentBind: BindRow[]): VarianceSummary;
export interface PostPlanItem {
    variantId: number;
    toStockLocationId: number;
    realQty: number;
    zoneId: number | null;
    binId: number | null;
}
export interface PostPlan {
    items: PostPlanItem[];
}
/**
 * 过账项（规格 §6.3 步骤 5）：
 * - 有差异 → realQty = 实盘合计
 * - 无差异但库位变更 → realQty = 当前账面（仅触发原地归位，不动数量）
 * - 两者都不是 → 不生成项
 * 未盘变体不出现在 summary.byVariant 中，因此天然不会进入过账计划（过账只覆盖有差异 / 仅库位变更的变体）。
 */
export declare function buildPostItems(input: {
    summary: VarianceSummary;
    stockLocationId: number;
}): PostPlan;
/** 录入后盘次状态：有实盘即 COUNTING；终态不回退（幂等保护） */
export declare function resolveWaveStateAfterCount(current: StocktakeWaveState, countedCount: number): StocktakeWaveState;
/** 盘次集合变化后任务状态：全部 SUBMITTED/CANCELLED → COUNTED；否则（已有盘次）COUNTING */
export declare function resolveTaskStateAfterWaves(current: StocktakeTaskState, waves: {
    state: StocktakeWaveState;
}[]): StocktakeTaskState;
/** 盘次独占校验（规格 §3.6）：非负责人/未认领一律拒绝并回传原因 */
export declare function waveOwnerError(assigneeId: string | null | undefined, operatorId: string | null | undefined, assigneeName?: string | null): string | null;
export interface ScanBin {
    binId: number;
    binCode: string;
    zoneId: number;
}
export interface ScanLine {
    lineId: number;
    variantId: number;
    sku: string;
    barcode: string | null;
    internalCode: string | null;
}
export interface ScanVariant {
    variantId: number;
    sku: string;
    barcode: string | null;
    internalCode: string | null;
    name?: string;
}
export type ScanHit = {
    kind: 'bin';
    binId: number;
    binCode: string;
    zoneId: number;
} | {
    kind: 'line';
    lineId: number;
    variantId: number;
} | {
    kind: 'extra';
    variantId: number;
    sku: string;
    name?: string;
} | {
    kind: 'none';
    raw: string;
};
/**
 * 扫码解析优先级（规格 §8.3）：库位码 → 内部码 → 条形码 → SKU → 未命中。
 * 命中的永远是「任务内应盘行」优先，其次才是清单外变体（避免把清单内变体误登记为盘盈）。
 */
export declare function resolveScanCode(raw: string, ctx: {
    bins: ScanBin[];
    lines: ScanLine[];
    variants: ScanVariant[];
}): ScanHit;
export type StateFilterMode = 'none' | 'one' | 'many';
export interface StateFilter {
    mode: StateFilterMode;
    values: string[];
}
/**
 * 列表状态过滤解析（规格 §7.1）：state（单值）优先 → states（多值）→ 都为空则不过滤。
 * 优先级必须写单测锁住：前端「已结束」页签只下发 states，历史调用方只下发 state。
 */
export declare function parseStateFilter(options?: {
    state?: string | null;
    states?: string[] | null;
}): StateFilter;
/** 统计输入行：StocktakeLine 的纯函数投影（不引入实体依赖） */
export interface StatLine {
    waveId: number;
    zoneId: number | null;
    zoneCode: string | null;
    binId: number | null;
    binCode: string | null;
    isExtra: boolean;
    countedQty: number | null;
    countedById: string | null;
    countedByName: string | null;
    countedAt: Date | null;
}
export interface BinStat {
    zoneId: number | null;
    zoneCode: string | null;
    binId: number | null;
    binCode: string | null;
    expectedLines: number;
    countedLines: number;
    uncountedLines: number;
    extraLines: number;
}
export interface CounterStat {
    countedById: string | null;
    countedByName: string | null;
    countedLines: number;
    extraLines: number;
    waveCount: number;
    lastCountedAt: Date | null;
}
/**
 * 按库位聚合（规格 §7.3）：只出作业量，不出任何差异数量/金额
 * （差异是变体口径，摊到库位会重复计数 —— 规格 §3.3）。
 */
export declare function aggregateByBin(lines: StatLine[]): BinStat[];
/** 按盘点人聚合（规格 §7.3）：只统计「确实被盘过」的行（含盘盈行）。 */
export declare function aggregateByCounter(lines: StatLine[]): CounterStat[];
export type CsvCell = string | number | boolean | Date | null | undefined;
/** 导出行数上限（规格 §7.4）：超出即截断并置 truncated=true */
export declare const CSV_MAX_ROWS = 20000;
/**
 * CSV 序列化（规格 §7.4，前后端同一规则）：
 * ① 首字符 BOM（Excel 中文不乱码）② 行尾 CRLF ③ 含 , " \n \r 时整体引号包裹、内部 " 翻倍
 * ④ null/undefined → 空字段；boolean → 是/否；Date → ISO ⑤ 行数上限截断。
 */
export declare function toCsv(rows: CsvCell[][], maxRows?: number): string;
