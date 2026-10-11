import { LocalizedText } from './types';

/** jsonb 键的默认 locale（主市场中文，规格 §8 回退链第二级） */
export const DEFAULT_LOCALE_KEY = 'zh-CN';

/**
 * Vendure LanguageCode → jsonb 键映射（规格 §8）。
 * jsonb 只存 zh-CN / en-US；zh_Hant 映射为 zh-TW 后 localizeText 会
 * 走回退链落到 zh-CN（未来要支持繁体时 jsonb 加 zh-TW 键即可，不用改代码）。
 */
const LOCALE_KEY_MAP: Record<string, string> = {
    zh: 'zh-CN',
    zh_Hans: 'zh-CN',
    zh_Hans_CN: 'zh-CN',
    zh_Hant: 'zh-TW',
    zh_Hant_TW: 'zh-TW',
    en: 'en-US',
    en_US: 'en-US',
};

export function resolveLocaleKey(languageCode: string): string {
    if (LOCALE_KEY_MAP[languageCode]) {
        return LOCALE_KEY_MAP[languageCode];
    }
    // 未收录的扩展码按语言主码前缀匹配（如 zh_Hans_MO）
    const underscore = languageCode.indexOf('_');
    const base = underscore === -1 ? languageCode : languageCode.slice(0, underscore);
    return LOCALE_KEY_MAP[base] ?? DEFAULT_LOCALE_KEY;
}

/**
 * LocalizedText 取值（规格 §8 回退链）：
 * 当前 localeKey → DEFAULT_LOCALE_KEY → 首个非空值 → fallback。
 */
export function localizeText(
    text: LocalizedText | null | undefined,
    localeKey: string,
    fallback = '',
): string {
    if (text == null) {
        return fallback;
    }
    if (typeof text === 'string') {
        return text === '' ? fallback : text;
    }
    for (const key of [localeKey, DEFAULT_LOCALE_KEY]) {
        const value = text[key];
        if (typeof value === 'string' && value !== '') {
            return value;
        }
    }
    const first = Object.values(text).find(v => typeof v === 'string' && v !== '');
    return first ?? fallback;
}
