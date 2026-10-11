"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCalculator = getCalculator;
exports.registerCalculator = registerCalculator;
exports.listCalculators = listCalculators;
const bracelet_calculator_1 = require("./bracelet-calculator");
const sum_1 = require("./sum");
const registry = {
    sum: sum_1.sumCalculator,
    bracelet: bracelet_calculator_1.braceletCalculator,
};
/**
 * 按 calculatorKey 取计算器；null/未知 key 一律回退内置 sum（规格 §5.3）。
 * 新玩法注册新 key：registerCalculator('car-model', fn)。
 */
function getCalculator(key) {
    return (key != null && registry[key]) || registry.sum;
}
function registerCalculator(key, fn) {
    registry[key] = fn;
}
function listCalculators() {
    return Object.keys(registry);
}
//# sourceMappingURL=registry.js.map