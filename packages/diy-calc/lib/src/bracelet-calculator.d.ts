import { Calculator } from './types';
/**
 * 手串计算器（key: 'bracelet'）。
 * - 主珠缺失 → 空 BOM（纯函数不抛错，C 端演示热路径安全）
 * - 焦点珠/隔片按 §7.3 二次收敛：先把 k·(ts+gap) 与焦点珠角从可用周长扣掉再算配珠，≤3 轮
 * - 混合组成的几何展示值用颗数加权平均 pitch/d 套正多边形公式（近似；BOM 与计价不受影响）
 */
export declare const braceletCalculator: Calculator;
