import { LanguageCode } from '@vendure/core';
/**
 * 券多语言文本。允许两种形态：
 *  - 纯字符串（既有历史数据 / 单语言文案）
 *  - 按 LanguageCode 键索引的多语言映射，如 `{ zh_Hans: '满100减20', en: '20 off 100' }`
 */
export type LocalizedText = string | Partial<Record<LanguageCode, string>>;
/**
 * 多语言文本的 DB 列转换：DB 内始终以字符串落库（纯字符串原样存；对象/JSON 字符串存
 * 序列化结果），读写时原样保留。券模板与券包实体共用。
 */
export declare const localizedTextColumn: {
    to: (value: LocalizedText | null | undefined) => string | null | undefined;
    from: (value: LocalizedText | null | undefined) => LocalizedText | null | undefined;
};
/**
 * 按当前会话语言 `locale` 求值本地化文本，逐级回退：
 *  1. 纯字符串 → 直接返回（向后兼容既有 `name: string`）；
 *  2. `locale` 命中 → 返回该语言文案；
 *  3. `en` 兜底；
 *  4. 记录中首个字符串值；
 *  5. `fallback`（默认空串）。
 */
export declare function localizeText(v: LocalizedText | undefined, locale: LanguageCode, fallback?: string): string;
/**
 * 将 LocalizedText 拆分为各语言的挂数字典（供后台编辑回显）。
 * 纯字符串视作唯一文案（同时作为 zh_Hans / en 的兜底）；JSON 对象则按 key 展开。
 */
export declare function localizedParts(v: LocalizedText | undefined): Record<string, string | undefined>;
