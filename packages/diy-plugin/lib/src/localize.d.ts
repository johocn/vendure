import { LocalizedText } from './types';
/** jsonb 键的默认 locale（主市场中文，规格 §8 回退链第二级） */
export declare const DEFAULT_LOCALE_KEY = "zh-CN";
export declare function resolveLocaleKey(languageCode: string): string;
/**
 * LocalizedText 取值（规格 §8 回退链）：
 * 当前 localeKey → DEFAULT_LOCALE_KEY → 首个非空值 → fallback。
 */
export declare function localizeText(text: LocalizedText | null | undefined, localeKey: string, fallback?: string): string;
