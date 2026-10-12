import { Calculator } from './types';
/**
 * 手串计算器 v2（key: 'bracelet'）。
 * - 主珠缺失 → 空 BOM（纯函数不抛错，C 端演示热路径安全）
 * - v1 形状（单 main + 至多单 spacer/focal，且 main/spacer 槽位未用 qtyOverride）走 v1 原路径，数值零回归
 * - v2 多素材路径：多主珠/多隔片、qtyOverride 定颗数或作收敛权重、decor 只计价
 */
export declare const braceletCalculator: Calculator;
