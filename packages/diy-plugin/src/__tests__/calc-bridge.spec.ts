import { describe, expect, it } from 'vitest';

import { runDiyCalc } from '../calc-bridge';
import { DiyMaterial } from '../entities/diy-material.entity';
import { DiyTemplate } from '../entities/diy-template.entity';
import { DiyPlanSpec } from '../types';

function mat(p: Partial<DiyMaterial> & { id: number; code: string }): DiyMaterial {
    return {
        app: null,
        sourceMaterialId: null,
        name: { 'zh-CN': p.code },
        categoryId: 1,
        shape: 'round',
        diameter: 8,
        axialLength: 8,
        holeSize: 1,
        attrs: null,
        render: null,
        price: 100,
        priceUnit: 'piece',
        currency: 'CNY',
        stock: 100,
        images: null,
        enabled: true,
        sortOrder: 0,
        ...p,
    } as DiyMaterial;
}

const template = {
    calculatorKey: 'bracelet',
    config: {
        slots: [
            { key: 'main', name: { 'zh-CN': '主珠' }, role: 'main', required: true, quantityMode: 'calculated' },
        ],
        params: [],
        constraints: [],
        presentation: { renderer: 'bracelet', blocks: [] },
    },
} as unknown as DiyTemplate;

const spec: DiyPlanSpec = {
    slots: { main: { materialId: '11' } },
    params: { wristSize: 155, fit: 'comfortable', gap: 0.5 },
};

describe('runDiyCalc', () => {
    it('bridges spec + merged materials through the bracelet calculator', () => {
        const main = mat({ id: 11, code: 'A-AGS-08-N', name: { 'zh-CN': '猫眼玛瑙', 'en-US': 'Cat eye agate' } });
        const out = runDiyCalc(template, spec, [main], 'zh_Hans');
        // 155/comfortable/0.5 + 8mm 主珠 → 22 颗（与 @diy/calc bracelet-calculator 默认参数断言同源）
        expect(out.calc?.count).toBe(22);
        expect(out.bom.items).toHaveLength(1);
        expect(out.bom.items[0]).toMatchObject({
            materialId: '11',
            code: 'A-AGS-08-N',
            name: '猫眼玛瑙',
            qty: 22,
            unitPrice: 100,
        });
        expect(out.bom.totalAmount).toBe(2200);
    });

    it('falls back to the built-in sum calculator when calculatorKey is null', () => {
        const out = runDiyCalc(
            { ...template, calculatorKey: null },
            { slots: { main: { materialId: '11', qtyOverride: 3 } }, params: {} },
            [mat({ id: 11, code: 'X' })],
            'zh_Hans',
        );
        expect(out.calc).toBeNull();
        expect(out.bom.totalAmount).toBe(300);
    });

    it('localizes material names by languageCode (zh_Hans → zh-CN)', () => {
        const main = mat({ id: 11, code: 'A-AGS-08-N', name: { 'zh-CN': '猫眼玛瑙', 'en-US': 'Cat eye agate' } });
        const en = runDiyCalc(template, spec, [main], 'en_US');
        expect(en.bom.items[0].name).toBe('Cat eye agate');
    });

    it('throws on unknown slot key', () => {
        const bad = { slots: { nope: { materialId: '11' } }, params: {} } as DiyPlanSpec;
        expect(() => runDiyCalc(template, bad, [mat({ id: 11, code: 'X' })], 'zh_Hans')).toThrow('Unknown slot');
    });

    it('throws when a referenced material is missing', () => {
        expect(() => runDiyCalc(template, spec, [], 'zh_Hans')).toThrow('not found');
    });

    it('throws on invalid template config', () => {
        expect(() =>
            runDiyCalc({ ...template, config: { slots: [] } } as unknown as DiyTemplate, spec, [mat({ id: 11, code: 'X' })], 'zh_Hans'),
        ).toThrow('Invalid template config');
    });

    it('v2 slotList: multi-main byCount quantities follow qtyOverride', () => {
        const a = mat({ id: 11, code: 'A', diameter: 8, axialLength: 8, holeSize: 1, price: 100 });
        const b = mat({ id: 12, code: 'B', diameter: 6, axialLength: 6, holeSize: 1, price: 60 });
        const out = runDiyCalc(
            template,
            {
                slots: { main: { materialId: '11' } },
                params: { wristSize: 155, fit: 'comfortable', gap: 1 },
                slotList: [
                    { role: 'main', materialId: '11', qtyOverride: 10 },
                    { role: 'main', materialId: '12', qtyOverride: 5 },
                ],
            } as DiyPlanSpec,
            [a, b],
            'zh_Hans',
        );
        expect(out.calc?.count).toBe(15);
        expect(out.bom.items).toHaveLength(2);
        const byId = new Map(out.bom.items.map(i => [i.materialId, i]));
        expect(byId.get('11')?.qty).toBe(10);
        expect(byId.get('12')?.qty).toBe(5);
        expect(out.bom.totalAmount).toBe(10 * 100 + 5 * 60);
    });

    it('v2 free: sequence drives geometry and BOM; decor priced only', () => {
        const a = mat({ id: 11, code: 'A', diameter: 8, axialLength: 8, holeSize: 1, price: 100 });
        const b = mat({ id: 12, code: 'B', diameter: 6, axialLength: 6, holeSize: 1, price: 60 });
        const d = mat({ id: 13, code: 'D', diameter: 3, axialLength: 3, holeSize: 1, price: 30 });
        const out = runDiyCalc(
            template,
            {
                slots: { main: { materialId: '11' } },
                params: { wristSize: 155, fit: 'comfortable', gap: 1 },
                slotList: [
                    { role: 'main', materialId: '11' },
                    { role: 'main', materialId: '12' },
                    { role: 'decor', materialId: '13', qtyOverride: 2 },
                ],
                sequence: ['11', '12', '11', '12', '11'],
            } as DiyPlanSpec,
            [a, b, d],
            'zh_Hans',
        );
        // 环上 5 颗：3×A + 2×B；decor D 只计价 2 颗、不进几何
        const byId = new Map(out.bom.items.map(i => [i.materialId, i]));
        expect(byId.get('11')?.qty).toBe(3);
        expect(byId.get('12')?.qty).toBe(2);
        expect(byId.get('13')?.qty).toBe(2);
        expect(out.bom.totalAmount).toBe(3 * 100 + 2 * 60 + 2 * 30);
        expect(out.calc?.count).toBe(5);
        // 中心线 = 3×(8+1) + 2×(6+1) = 41；配线 = 中心线 + 160 打结留量
        expect(out.calc?.centerCircumference).toBe(41);
        expect(out.bom.cord?.length).toBe(201);
    });

    it('v2 slotList without sequence falls through to the v2 calculator path', () => {
        const a = mat({ id: 11, code: 'A', diameter: 8, axialLength: 8, holeSize: 1, price: 100 });
        const out = runDiyCalc(
            template,
            {
                slots: { main: { materialId: '11', qtyOverride: 7 } },
                params: { wristSize: 155, fit: 'comfortable', gap: 1 },
                slotList: [{ role: 'main', materialId: '11', qtyOverride: 7 }],
            } as DiyPlanSpec,
            [a],
            'zh_Hans',
        );
        expect(out.calc?.count).toBe(7);
        expect(out.bom.items[0]).toMatchObject({ materialId: '11', qty: 7 });
    });

    it('v2 throws when a slotList material is missing from the merged view', () => {
        expect(() =>
            runDiyCalc(
                template,
                {
                    slots: { main: { materialId: '11' } },
                    params: {},
                    slotList: [{ role: 'main', materialId: '99' }],
                } as DiyPlanSpec,
                [mat({ id: 11, code: 'X' })],
                'zh_Hans',
            ),
        ).toThrow('not found');
    });
});
