import { describe, expect, it } from 'vitest';
import { mergePreview, resolvePaletteTokens } from '../merge-config';

const g = { primaryColor: '#000000', radius: 4 };

describe('resolvePaletteTokens', () => {
    it('scheme 命中预设展开 tokens', () => {
        expect(resolvePaletteTokens({ scheme: 'jd-red' }).primaryColor).toBe('#e1251b');
    });
    it('未知 scheme → 空对象（回退），不抛错', () => {
        expect(resolvePaletteTokens({ scheme: 'nope' })).toEqual({});
    });
    it('无 palette / 坏数据 → 空对象', () => {
        expect(resolvePaletteTokens(null)).toEqual({});
        expect(resolvePaletteTokens('x')).toEqual({});
    });
    it('显式 tokens 覆盖预设同名', () => {
        expect(resolvePaletteTokens({ scheme: 'jd-red', tokens: { radius: 2 } }).radius).toBe(2);
    });
});

describe('mergePreview 预览 = C 端实际渲染', () => {
    it('L2 palette.scheme 被展开为令牌（与 C 端一致）', () => {
        const l2 = { palette: { scheme: 'jd-red' } };
        const { merged } = mergePreview(g, l2, {});
        expect(merged.primaryColor).toBe('#e1251b');
    });
    it('L3 overrides 覆盖 L2 展开值', () => {
        const l2 = { palette: { scheme: 'jd-red' } };
        const { merged } = mergePreview(g, l2, { primaryColor: '#123456' });
        expect(merged.primaryColor).toBe('#123456');
    });
    it('sourceByKey 取最高生效层级（L3 > L2 > L1）', () => {
        const l2 = { palette: { scheme: 'jd-red' } };
        const { sourceByKey } = mergePreview(g, l2, { accentColor: '#fff' });
        expect(sourceByKey.primaryColor).toBe('L2');
        expect(sourceByKey.accentColor).toBe('L3');
        expect(sourceByKey.radius).toBe('L2');
    });
    it('L2 无 palette 时 L1 值不回退丢失', () => {
        const { merged } = mergePreview({ primaryColor: '#0f0f0f' }, {}, {});
        expect(merged.primaryColor).toBe('#0f0f0f');
    });
});