import { CalcBom, Calculator, CalcMaterial } from './types';
/**
 * 内置 sum 计算器：BOM = Σ 槽位素材 × 数量。
 * 选择型玩法（如汽车模型延后接入）零代码即用；calculatorKey 为 null/未知时的兜底。
 */
export declare function buildSumBom(slots: {
    materialId?: string;
    qtyOverride?: number;
}[], materials: CalcMaterial[]): CalcBom;
export declare const sumCalculator: Calculator;
