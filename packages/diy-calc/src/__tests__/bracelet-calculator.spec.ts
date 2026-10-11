import { describe, expect, it } from 'vitest';

import { braceletCalculator } from '../bracelet-calculator';
import { CalcMaterial, SlotSelection } from '../types';

const main: CalcMaterial = {
    id: '1', code: 'A-AGS-08-N', name: '玛瑙 8mm', shape: 'round',
    diameter: 8, axialLength: 8, holeSize: 1, price: 150,
};
const focal: CalcMaterial = {
    id: '2', code: 'A-AGS-14-F', name: '玛瑙焦点 14mm', shape: 'drum',
    diameter: 14, axialLength: 14, holeSize: 1.2, price: 600,
};
const spacer: CalcMaterial = {
    id: '3', code: 'M-SSP-06-SV', name: '银隔片 6mm', shape: 'spacer',
    diameter: 6, axialLength: 2, holeSize: 1.5, price: 30,
};

const params = { wristSize: 150, fit: 'comfortable', gap: 0.5 };

function sel(key: string, role: SlotSelection['role'], materialId?: string, extra?: Partial<SlotSelection>): SlotSelection {
    return { key, role, materialId, ...extra };
}

describe('braceletCalculator', () => {
    it('主珠缺失时返回空 BOM（纯函数不抛错）', () => {
        const out = braceletCalculator({ params, slots: [sel('focal', 'focal', '2')], materials: [main, focal] });
        expect(out.calc).toBeNull();
        expect(out.bom.items).toHaveLength(0);
        expect(out.bom.cord).toBeNull();
    });

    it('纯主珠：150/8mm → 21 颗，BOM/配线/几何自洽', () => {
        const out = braceletCalculator({ params, slots: [sel('main', 'main', '1')], materials: [main] });
        expect(out.calc!.count).toBe(21);
        expect(out.calc!.countInitial).toBe(21);
        expect(out.bom.items).toHaveLength(1);
        expect(out.bom.items[0].qty).toBe(21);
        expect(out.bom.items[0].subtotal).toBe(21 * 150);
        expect(out.bom.totalCount).toBe(21);
        expect(out.bom.totalAmount).toBe(21 * 150);
        expect(out.calc!.cordDiameter).toBe(0.8); // min(孔径1−0.2, 1.0)
        expect(out.calc!.cordLength).toBeCloseTo(out.calc!.centerCircumference + 160, 6);
        expect(out.bom.cord!.diameter).toBe(0.8);
        expect(out.bom.geometry!.feedback).toBe('ok');
        expect(out.bom.geometry!.clearance).toBeCloseTo(out.calc!.clearance, 6);
    });

    it('带隔片 every=2：隔片数 = floor(总数/3)，BOM 聚合两行', () => {
        const out = braceletCalculator({
            params,
            slots: [sel('main', 'main', '1'), sel('spacer', 'spacer', '3', { every: 2 })],
            materials: [main, spacer],
        });
        const mainRow = out.bom.items.find(i => i.materialId === '1');
        const spacerRow = out.bom.items.find(i => i.materialId === '3');
        expect(mainRow).toBeDefined();
        expect(spacerRow).toBeDefined();
        expect(out.bom.items).toHaveLength(2);
        expect(spacerRow!.qty).toBe(Math.floor(out.calc!.count / 3));
        expect(out.calc!.count).toBe(mainRow!.qty + spacerRow!.qty);
        expect(out.bom.totalAmount).toBe(mainRow!.subtotal + spacerRow!.subtotal);
        expect(out.calc!.cordDiameter).toBe(0.8); // 最小孔径取 main 的 1mm
    });

    it('焦点珠模式：焦点珠恰 1 颗且计入 BOM', () => {
        const out = braceletCalculator({
            params,
            slots: [sel('main', 'main', '1'), sel('focal', 'focal', '2'), sel('spacer', 'spacer', '3', { every: 2 })],
            materials: [main, focal, spacer],
        });
        const focalRow = out.bom.items.find(i => i.materialId === '2');
        expect(focalRow).toBeDefined();
        expect(focalRow!.qty).toBe(1);
        expect(out.calc!.count).toBeGreaterThanOrEqual(2);
    });

    it('默认参数：无 params 时按 155/comfortable/0.5 → 22 颗', () => {
        const out = braceletCalculator({ params: {}, slots: [sel('main', 'main', '1')], materials: [main] });
        expect(out.calc!.count).toBe(22);
    });

    it('宽松 fit（ease=20）：150/8mm → 21 颗', () => {
        const out = braceletCalculator({
            params: { wristSize: 150, fit: 'loose', gap: 0.5 },
            slots: [sel('main', 'main', '1')],
            materials: [main],
        });
        expect(out.calc!.count).toBe(21);
    });
});
