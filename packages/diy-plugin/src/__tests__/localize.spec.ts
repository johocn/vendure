import { describe, expect, it } from 'vitest';

import { localizeText, resolveLocaleKey } from '../localize';

describe('resolveLocaleKey', () => {
    it('maps zh_Hans to zh-CN', () => {
        expect(resolveLocaleKey('zh_Hans')).toBe('zh-CN');
    });

    it('maps zh_Hant to zh-TW', () => {
        expect(resolveLocaleKey('zh_Hant')).toBe('zh-TW');
    });

    it('maps plain zh to zh-CN', () => {
        expect(resolveLocaleKey('zh')).toBe('zh-CN');
    });

    it('maps en to en-US', () => {
        expect(resolveLocaleKey('en')).toBe('en-US');
    });

    it('maps extended code zh_Hans_CN by prefix', () => {
        expect(resolveLocaleKey('zh_Hans_CN')).toBe('zh-CN');
    });

    it('falls back to zh-CN for unknown codes', () => {
        expect(resolveLocaleKey('xx')).toBe('zh-CN');
    });
});

describe('localizeText', () => {
    it('returns the current locale value', () => {
        const text = { 'zh-CN': '水晶', 'en-US': 'Crystal' };
        expect(localizeText(text, 'zh-CN')).toBe('水晶');
        expect(localizeText(text, 'en-US')).toBe('Crystal');
    });

    it('falls back to default locale zh-CN', () => {
        expect(localizeText({ 'zh-CN': '水晶' }, 'en-US')).toBe('水晶');
    });

    it('zh_Hant request falls through zh-TW to zh-CN', () => {
        expect(localizeText({ 'zh-CN': '水晶' }, resolveLocaleKey('zh_Hant'))).toBe('水晶');
    });

    it('falls back to first non-empty value', () => {
        expect(localizeText({ 'en-US': 'Crystal' }, 'zh-CN')).toBe('Crystal');
    });

    it('uses fallback when empty everywhere', () => {
        expect(localizeText({ 'zh-CN': '' }, 'zh-CN', '未命名')).toBe('未命名');
        expect(localizeText(null, 'zh-CN', '未命名')).toBe('未命名');
        expect(localizeText(undefined, 'zh-CN')).toBe('');
    });

    it('passes plain strings through', () => {
        expect(localizeText('水晶', 'en-US')).toBe('水晶');
        expect(localizeText('', 'zh-CN', '未命名')).toBe('未命名');
    });
});
