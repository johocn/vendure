import { describe, expect, it } from 'vitest';
import { sumCalculator } from '../sum';
import { CalcMaterial, SlotSelection } from '../types';

const bead: CalcMaterial = {
    id: '1', code: 'A-AGS-08-N', name: '玛瑙玉髓猫眼 8mm', shape: 'round',
    diameter: 8, axialLength: 8, holeSize: 1, price: 150,
};
const spacer: CalcMaterial = {
    id: '2', code: 'M-SSP-06-SV', name: '圆隔片 6mm 银', shape: 'spacer',
    diameter: 6, axialLength: 2, holeSize: 1.5, price: 30,
};

function sel(key: string, role: SlotSelection['role'], materialId?: string, qtyOverride?: number): SlotSelection {
    return { key, role, materialId, qtyOverride };
}

describe('sum 内置计算器（选择型玩法兜底）', () => {
    it('BOM = Σ 槽位素材 × 数量，金额分为整数', () => {
        const out = sumCalculator({
            params: {},
            slots: [sel('a', 'main', '1', 4), sel('b', 'decor', '2', 6)],
            materials: [bead, spacer],
        });
        expect(out.calc).toBeNull();
        expect(out.bom.items).toHaveLength(2);
        expect(out.bom.totalCount).toBe(10);
        expect(out.bom.totalAmount).toBe(4 * 150 + 6 * 30);
    });
    it('qtyOverride 缺省为 1', () => {
        const out = sumCalculator({
            params: {},
            slots: [sel('a', 'main', '1')],
            materials: [bead],
        });
        expect(out.bom.items[0].qty).toBe(1);
        expect(out.bom.totalAmount).toBe(150);
    });
    it('未选槽位/未知素材跳过，不抛错', () => {
        const out = sumCalculator({
            params: {},
            slots: [sel('a', 'main'), sel('b', 'decor', '999')],
            materials: [bead],
        });
        expect(out.bom.items).toHaveLength(0);
        expect(out.bom.totalAmount).toBe(0);
    });
    it('同素材多槽位合并为一行', () => {
        const out = sumCalculator({
            params: {},
            slots: [sel('a', 'main', '1', 2), sel('b', 'secondary', '1', 3)],
            materials: [bead],
        });
        expect(out.bom.items).toHaveLength(1);
        expect(out.bom.items[0].qty).toBe(5);
    });
    it('cord/geometry 为 null（无几何语义）', () => {
        const out = sumCalculator({ params: {}, slots: [], materials: [] });
        expect(out.bom.cord).toBeNull();
        expect(out.bom.geometry).toBeNull();
    });
});
