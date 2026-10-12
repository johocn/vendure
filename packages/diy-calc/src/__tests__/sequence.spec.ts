import { describe, expect, it } from 'vitest';

import { generateSequence, sequenceGeometry } from '../sequence';

const materials = [
    { id: 'm1', code: 'NH-8', name: '南红', price: 250, diameter: 8, axialLength: 8, shape: '圆珠', holeSize: 1.0 },
    { id: 'm2', code: 'QJ-10', name: '青金', price: 180, diameter: 10, axialLength: 10, shape: '圆珠', holeSize: 1.0 },
    { id: 'sp', code: 'JG-4', name: '金隔', price: 60, diameter: 4, axialLength: 2, shape: '隔片', holeSize: 1.2 },
    { id: 'de', code: 'LS-1', name: '流苏', price: 1200, diameter: 20, axialLength: 20, shape: '装饰', holeSize: null },
];

describe('generateSequence', () => {
    it('均匀交替模式按槽位轮转铺满', () => {
        const seq = generateSequence(
            [{ role: 'main', materialId: 'm1' }, { role: 'main', materialId: 'm2' }] as any,
            'alternate',
            6,
        );
        expect(seq).toEqual(['m1', 'm2', 'm1', 'm2', 'm1', 'm2']);
    });

    it('隔片 every 语义：每 (every+1) 颗插 1 片', () => {
        const slots = [{ role: 'main', materialId: 'm1' }, { role: 'spacer', materialId: 'sp', every: 2 }] as any;
        const seq = generateSequence(slots, 'alternate', 6);
        expect(seq.filter(x => x === 'sp').length).toBe(2);
    });

    it('random 模式含全部材料且长度正确（固定种子）', () => {
        const seq = generateSequence(
            [{ role: 'main', materialId: 'm1' }, { role: 'main', materialId: 'm2' }] as any,
            'random',
            7,
            () => 0.4,
        );
        expect(seq.length).toBe(7);
        expect(new Set(seq)).toEqual(new Set(['m1', 'm2']));
    });
});

describe('sequenceGeometry', () => {
    it('中心线=Σ(轴向+gap)，decor 不进几何', () => {
        const seq = ['m1', 'm2', 'm1', 'sp', 'm1', 'm2', 'm1'];
        const { calc, bom } = sequenceGeometry(seq, materials as any, 0.5, 155);
        expect(Math.round(calc!.centerCircumference * 10) / 10).toBeCloseTo(57.5, 1);
        expect(calc!.count).toBe(7);
        expect(bom.items.find(i => i.materialId === 'de')).toBeUndefined();
        expect(bom.totalAmount).toBe(4 * 250 + 2 * 180 + 1 * 60);
    });

    it('decorSlots 只计价不进几何/颗数', () => {
        const seq = ['m1', 'm1', 'm1'];
        const { calc, bom } = sequenceGeometry(seq, materials as any, 0.5, 155, 15, [
            { role: 'decor', materialId: 'de', qtyOverride: 1 },
        ] as any);
        expect(calc!.count).toBe(3);
        expect(bom.items.find(i => i.materialId === 'de')!.qty).toBe(1);
        expect(bom.totalAmount).toBe(3 * 250 + 1200);
    });

    it('空序列返回空 BOM 不抛错', () => {
        const { calc, bom } = sequenceGeometry([], materials as any, 0.5, 155);
        expect(calc).toBeNull();
        expect(bom.totalAmount).toBe(0);
    });
});
