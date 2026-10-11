import { describe, expect, it } from 'vitest';

import { parseTemplateConfig } from '../template-config';

const validConfig = {
    slots: [
        {
            key: 'main',
            name: { 'zh-CN': '主珠', 'en-US': 'Main beads' },
            role: 'main',
            required: true,
            quantityMode: 'calculated',
            filter: { categoryCodes: ['crystal'], shapes: ['round'], diameterRange: [6, 12] },
        },
        {
            key: 'spacer',
            name: { 'zh-CN': '隔片' },
            role: 'spacer',
            required: false,
            quantityMode: 'user',
            quantityRange: [0, 34],
            defaultEvery: 2,
        },
    ],
    params: [{ key: 'wristSize', type: 'number', unit: 'mm', min: 120, max: 200, default: 155 }],
    constraints: [],
    presentation: { renderer: 'bracelet', blocks: ['gallery', 'price'] },
};

describe('parseTemplateConfig', () => {
    it('returns the config for a valid input', () => {
        const parsed = parseTemplateConfig(validConfig);
        expect(parsed).not.toBeNull();
        expect(parsed!.slots).toHaveLength(2);
        expect(parsed!.presentation.renderer).toBe('bracelet');
        expect(parsed!.presentation.blocks).toEqual(['gallery', 'price']);
    });

    it('defaults params/constraints/blocks when missing', () => {
        const parsed = parseTemplateConfig({
            slots: validConfig.slots,
            presentation: { renderer: 'bracelet' },
        });
        expect(parsed).not.toBeNull();
        expect(parsed!.params).toEqual([]);
        expect(parsed!.constraints).toEqual([]);
        expect(parsed!.presentation.blocks).toEqual([]);
    });

    it('returns null for null/string/array input', () => {
        expect(parseTemplateConfig(null)).toBeNull();
        expect(parseTemplateConfig('oops')).toBeNull();
        expect(parseTemplateConfig([validConfig])).toBeNull();
        expect(parseTemplateConfig(undefined)).toBeNull();
    });

    it('returns null when slots missing or empty', () => {
        expect(parseTemplateConfig({ ...validConfig, slots: [] })).toBeNull();
        expect(parseTemplateConfig({ presentation: validConfig.presentation })).toBeNull();
    });

    it('returns null when a slot misses key fields', () => {
        const bad1 = { ...validConfig, slots: [{ ...validConfig.slots[0], key: '' }] };
        expect(parseTemplateConfig(bad1)).toBeNull();
        const bad2 = { ...validConfig, slots: [{ ...validConfig.slots[0], role: 'nope' }] };
        expect(parseTemplateConfig(bad2)).toBeNull();
        const bad3 = { ...validConfig, slots: [{ ...validConfig.slots[0], quantityMode: 'auto' }] };
        expect(parseTemplateConfig(bad3)).toBeNull();
        const bad4 = { ...validConfig, slots: [{ ...validConfig.slots[0], required: 'yes' }] };
        expect(parseTemplateConfig(bad4)).toBeNull();
    });

    it('returns null when presentation missing or renderer invalid', () => {
        const { presentation, ...noPresentation } = validConfig;
        expect(parseTemplateConfig(noPresentation)).toBeNull();
        expect(parseTemplateConfig({ ...validConfig, presentation: {} })).toBeNull();
        expect(parseTemplateConfig({ ...validConfig, presentation: { renderer: '' } })).toBeNull();
    });
});
