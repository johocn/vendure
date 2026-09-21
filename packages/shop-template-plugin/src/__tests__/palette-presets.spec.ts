import { describe, expect, it } from 'vitest';
import { PALETTE_PRESETS } from '../palette-presets';

describe('PALETTE_PRESETS 权威副本', () => {
    it('包含 8 套预设且与 C 端 scheme 同名', () => {
        expect(Object.keys(PALETTE_PRESETS).sort()).toEqual([
            'dawn-gold',
            'fresh-green',
            'jd-red',
            'midnight',
            'pdd-red',
            'taobao-orange',
            'tech-blue',
            'vip-blue',
        ]);
    });
    it('每套都有 primaryColor 且 scheme 与 key 一致', () => {
        for (const [key, def] of Object.entries(PALETTE_PRESETS)) {
            expect(def.scheme).toBe(key);
            expect(typeof def.tokens.primaryColor).toBe('string');
            expect(def.tokens.primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
        }
    });
    it('jd-red 与 C 端字典一致', () => {
        expect(PALETTE_PRESETS['jd-red'].tokens).toEqual({
            primaryColor: '#e1251b',
            accentColor: '#ffeceb',
            radius: 8,
        });
    });
});