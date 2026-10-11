import { Calculator } from './types';
/**
 * 按 calculatorKey 取计算器；null/未知 key 一律回退内置 sum（规格 §5.3）。
 * 新玩法注册新 key：registerCalculator('car-model', fn)。
 */
export declare function getCalculator(key?: string | null): Calculator;
export declare function registerCalculator(key: string, fn: Calculator): void;
export declare function listCalculators(): string[];
