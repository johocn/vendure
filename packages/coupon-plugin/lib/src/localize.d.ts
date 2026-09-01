import { LanguageCode } from '@vendure/core';
/**
 * 券多语言文本。允许两种形态：
 *  - 纯字符串（既有历史数据 / 单语言文案）
 *  - 按 LanguageCode 键索引的多语言映射，如 `{ zh_Hans: '满100减20', en: '20 off 100' }`
 */
export type LocalizedText = string | Partial<Record<LanguageCode, string>>;
/**
 * 按当前会话语言 `locale` 求值本地化文本，逐级回退：
 *  1. 纯字符串 → 直接返回（向后兼容既有 `name: string`）；
 *  2. `locale` 命中 → 返回该语言文案；
 *  3. `en` 兜底；
 *  4. 记录中首个字符串值；
 *  5. `fallback`（默认空串）。
 */
export declare function localizeText(v: LocalizedText | undefined, locale: LanguageCode, fallback?: string): string;
