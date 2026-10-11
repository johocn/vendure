import { Calculator } from './types';
import { braceletCalculator } from './bracelet-calculator';
import { sumCalculator } from './sum';

const registry: Record<string, Calculator> = {
    sum: sumCalculator,
    bracelet: braceletCalculator,
};

/**
 * 按 calculatorKey 取计算器；null/未知 key 一律回退内置 sum（规格 §5.3）。
 * 新玩法注册新 key：registerCalculator('car-model', fn)。
 */
export function getCalculator(key?: string | null): Calculator {
    return (key != null && registry[key]) || registry.sum;
}

export function registerCalculator(key: string, fn: Calculator): void {
    registry[key] = fn;
}

export function listCalculators(): string[] {
    return Object.keys(registry);
}
