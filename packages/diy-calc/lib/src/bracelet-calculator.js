"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.braceletCalculator = void 0;
const sum_1 = require("./sum");
const braceletCalculator = input => ({
    calc: null,
    bom: (0, sum_1.buildSumBom)(input.slots, input.materials),
});
exports.braceletCalculator = braceletCalculator;
//# sourceMappingURL=bracelet-calculator.js.map