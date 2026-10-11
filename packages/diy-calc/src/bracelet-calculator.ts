// src/bracelet-calculator.ts（Task 2 临时顶位；Task 11 替换为完整实现）
import { Calculator } from './types';
import { buildSumBom } from './sum';

export const braceletCalculator: Calculator = input => ({
    calc: null,
    bom: buildSumBom(input.slots, input.materials),
});
