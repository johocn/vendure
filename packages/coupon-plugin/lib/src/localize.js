"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localizeText = localizeText;
const core_1 = require("@vendure/core");
/**
 * 将文本解析为真正的对象形态。历史 / 旧版数据可能直接存了 JSON 字符串
 * （例如 GraphQL `String!` 标量里塞入的 `'{"zh_Hans":"..","en":".."}'`），
 * 这里做一次安全的反序列化：能解析成对象则返回对象，否则原样返回字符串。
 */
function unwrapLocalized(v) {
    if (typeof v !== 'string') {
        return v;
    }
    const trimmed = v.trim();
    // 仅对看起来像 JSON 的可疑串尝试解析，避免误解析明文文案
    if (trimmed.startsWith('{') || trimmed.startsWith('"')) {
        try {
            const parsed = JSON.parse(v);
            if (parsed != null && typeof parsed === 'object') {
                return parsed;
            }
        }
        catch (_a) {
            /* 不是合法 JSON，按纯字符串处理 */
        }
    }
    return v;
}
/**
 * 按当前会话语言 `locale` 求值本地化文本，逐级回退：
 *  1. 纯字符串 → 直接返回（向后兼容既有 `name: string`）；
 *  2. `locale` 命中 → 返回该语言文案；
 *  3. `en` 兜底；
 *  4. 记录中首个字符串值；
 *  5. `fallback`（默认空串）。
 */
function localizeText(v, locale, fallback = '') {
    // 兼容直接以 JSON 字符串存储的本地化内容
    const value = unwrapLocalized(v);
    if (value == null) {
        return fallback;
    }
    if (typeof value === 'string') {
        // 纯字符串（历史上单语言字段）原样返回
        return value;
    }
    const rec = value;
    const byLocale = rec[locale];
    if (byLocale != null && typeof byLocale === 'string') {
        return byLocale;
    }
    const en = rec[core_1.LanguageCode.en];
    if (en != null && typeof en === 'string') {
        return en;
    }
    const first = Object.values(rec).find(x => typeof x === 'string');
    return first !== null && first !== void 0 ? first : fallback;
}
//# sourceMappingURL=localize.js.map