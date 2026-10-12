import { describe, expect, it } from 'vitest';

import { braceletCalculator } from '../bracelet-calculator';

const materials = [
    { id: 'm1', code: 'NH-8', name: '南红', price: 250, diameter: 8, axialLength: 8, shape: '圆珠', holeSize: 1.0 },
    { id: 'm2', code: 'QJ-10', name: '青金', price: 180, diameter: 10, axialLength: 10, shape: '圆珠', holeSize: 1.0 },
    { id: 'sp', code: 'JG-4', name: '金隔', price: 60, diameter: 4, axialLength: 2, shape: '隔片', holeSize: 1.2 },
    { id: 'de', code: 'LS-1', name: '流苏', price: 1200, diameter: 20, axialLength: 20, shape: '装饰', holeSize: null },
];
const input = (slots: any[], params: any = {}) => ({ calculatorKey: 'bracelet', materials, slots, params } as any);

describe('v2 多主珠混搭（定手围收敛）', () => {
    it('两个主珠槽位收敛，BOM 三行，内孔接近目标', () => {
        const { calc, bom } = braceletCalculator(
            input(
                [
                    { role: 'main', materialId: 'm1' },
                    { role: 'main', materialId: 'm2' },
                    { role: 'spacer', materialId: 'sp', every: 2 },
                ],
                { wristSize: 160, fit: 'comfortable' },
            ),
        );
        expect(calc).not.toBeNull();
        expect(bom.items.length).toBe(3);
        expect(bom.totalAmount).toBeGreaterThan(0);
        expect(Math.abs(calc!.innerCircumference - 175)).toBeLessThan(25);
    });

    it('decor 只进 BOM 不进几何', () => {
        const { calc, bom } = braceletCalculator(
            input([{ role: 'main', materialId: 'm1' }, { role: 'decor', materialId: 'de', qtyOverride: 1 }]),
        );
        expect(bom.items.find(i => i.materialId === 'de')!.qty).toBe(1);
        expect(calc!.count).toBeLessThan(40); // decor 未计入颗数
    });

    it('qtyOverride 作收敛权重：主珠比例约 3:1', () => {
        const { bom } = braceletCalculator(
            input([
                { role: 'main', materialId: 'm1', qtyOverride: 3 },
                { role: 'main', materialId: 'm2' },
            ], { wristSize: 160 }),
        );
        const q1 = bom.items.find(i => i.materialId === 'm1')!.qty;
        const q2 = bom.items.find(i => i.materialId === 'm2')!.qty;
        expect(q1).toBeGreaterThan(q2);
    });
});

describe('v2 固定颗数模式', () => {
    it('main+spacer 全带 qtyOverride：总数精确 26', () => {
        const { calc, bom } = braceletCalculator(
            input([
                { role: 'main', materialId: 'm1', qtyOverride: 20 },
                { role: 'spacer', materialId: 'sp', every: 2, qtyOverride: 6 },
            ], { wristSize: 160 }),
        );
        expect(calc!.count).toBe(26);
        expect(bom.items.find(i => i.materialId === 'm1')!.qty).toBe(20);
        expect(bom.items.find(i => i.materialId === 'sp')!.qty).toBe(6);
    });

    it('固定模式含焦点珠 +1', () => {
        const { calc } = braceletCalculator(
            input([{ role: 'main', materialId: 'm1', qtyOverride: 10 }, { role: 'focal', materialId: 'm2' }]),
        );
        expect(calc!.count).toBe(11);
    });
});

describe('v1 向后兼容', () => {
    it('单主珠旧 spec 正常（数量级）', () => {
        const { calc, bom } = braceletCalculator(input([{ role: 'main', materialId: 'm1' }], { wristSize: 160 }));
        expect(calc!.count).toBeGreaterThan(10);
        expect(bom.items.length).toBe(1);
    });
});
