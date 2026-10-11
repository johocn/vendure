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
});
