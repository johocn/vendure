"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildQuoteNo = buildQuoteNo;
exports.quoteExpiresAt = quoteExpiresAt;
/**
 * 报价单号与有效期（纯函数，规格 §6.3）。
 * 单号不含价格/批次语义（与素材货号同哲学）：改价不换规则，重报价生成新号。
 * 随机与时间注入以便单测；随机字符排除易混 0/O/1/I。
 */
const QUOTE_NO_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const QUOTE_NO_RANDOM_LEN = 6;
function buildQuoteNo(now, random = Math.random) {
    const y = String(now.getFullYear()).padStart(4, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    let suffix = '';
    for (let i = 0; i < QUOTE_NO_RANDOM_LEN; i++) {
        suffix += QUOTE_NO_CHARS[Math.floor(random() * QUOTE_NO_CHARS.length)];
    }
    return `DIY-${y}${m}${d}-${suffix}`;
}
function quoteExpiresAt(now, ttlDays) {
    return new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
}
//# sourceMappingURL=quote-utils.js.map