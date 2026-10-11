"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const sum_1 = require("../sum");
const bead = {
    id: '1', code: 'A-AGS-08-N', name: '玛瑙玉髓猫眼 8mm', shape: 'round',
    diameter: 8, axialLength: 8, holeSize: 1, price: 150,
};
const spacer = {
    id: '2', code: 'M-SSP-06-SV', name: '圆隔片 6mm 银', shape: 'spacer',
    diameter: 6, axialLength: 2, holeSize: 1.5, price: 30,
};
function sel(key, role, materialId, qtyOverride) {
    return { key, role, materialId, qtyOverride };
}
(0, vitest_1.describe)('sum 内置计算器（选择型玩法兜底）', () => {
    (0, vitest_1.it)('BOM = Σ 槽位素材 × 数量，金额分为整数', () => {
        const out = (0, sum_1.sumCalculator)({
            params: {},
            slots: [sel('a', 'main', '1', 4), sel('b', 'decor', '2', 6)],
            materials: [bead, spacer],
        });
        (0, vitest_1.expect)(out.calc).toBeNull();
        (0, vitest_1.expect)(out.bom.items).toHaveLength(2);
        (0, vitest_1.expect)(out.bom.totalCount).toBe(10);
        (0, vitest_1.expect)(out.bom.totalAmount).toBe(4 * 150 + 6 * 30);
    });
    (0, vitest_1.it)('qtyOverride 缺省为 1', () => {
        const out = (0, sum_1.sumCalculator)({
            params: {},
            slots: [sel('a', 'main', '1')],
            materials: [bead],
        });
        (0, vitest_1.expect)(out.bom.items[0].qty).toBe(1);
        (0, vitest_1.expect)(out.bom.totalAmount).toBe(150);
    });
    (0, vitest_1.it)('未选槽位/未知素材跳过，不抛错', () => {
        const out = (0, sum_1.sumCalculator)({
            params: {},
            slots: [sel('a', 'main'), sel('b', 'decor', '999')],
            materials: [bead],
        });
        (0, vitest_1.expect)(out.bom.items).toHaveLength(0);
        (0, vitest_1.expect)(out.bom.totalAmount).toBe(0);
    });
    (0, vitest_1.it)('同素材多槽位合并为一行', () => {
        const out = (0, sum_1.sumCalculator)({
            params: {},
            slots: [sel('a', 'main', '1', 2), sel('b', 'secondary', '1', 3)],
            materials: [bead],
        });
        (0, vitest_1.expect)(out.bom.items).toHaveLength(1);
        (0, vitest_1.expect)(out.bom.items[0].qty).toBe(5);
    });
    (0, vitest_1.it)('cord/geometry 为 null（无几何语义）', () => {
        const out = (0, sum_1.sumCalculator)({ params: {}, slots: [], materials: [] });
        (0, vitest_1.expect)(out.bom.cord).toBeNull();
        (0, vitest_1.expect)(out.bom.geometry).toBeNull();
    });
});
//# sourceMappingURL=sum.spec.js.map