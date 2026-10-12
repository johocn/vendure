import { CalcBom, CalcMaterial, CalcResult, SlotSelection } from './types';
export type SequenceMode = 'alternate' | 'random' | 'zoned';
/**
 * 自由序列生成（纯函数）：
 * - 先按 qtyOverride 权重把 total 颗分配到各槽位（全部槽位都没权重则均分，余数给第一个槽位）；
 *   带 every 的隔片槽位不参与权重分配，qty = floor(total / (every + 1))
 * - alternate：槽位轮转铺满；random：Fisher-Yates 用注入 rng 洗牌；zoned：按槽位分区
 * - 返回 materialId 有序数组
 */
export declare function generateSequence(slots: SlotSelection[], mode: SequenceMode, total: number, rng?: () => number): string[];
/**
 * 序列几何与算量（纯函数，不抛错）：
 * - decor 不进几何环（按 decorSlots 里出现的 materialId 界定），只计价
 * - 中心线周长 = Σ(每颗 axialLength ?? diameter ?? 8 + gap)；pitchAvg = 中心线/颗数
 * - dAvg = 直径加权平均；内孔复用 innerCircOf(count, pitchAvg, dAvg)；clearance = 内孔 − wristSize
 * - cordLength = 中心线 + CORD_TAIL（打结留量）；cordDiameter 按环上最小孔径选档（decor 不参与）
 * - 空环返回 { calc: null, 空 BOM }
 */
export declare function sequenceGeometry(sequence: string[], materials: CalcMaterial[], gap: number, wristSize: number, ease?: number, decorSlots?: SlotSelection[]): {
    calc: CalcResult | null;
    bom: CalcBom;
};
