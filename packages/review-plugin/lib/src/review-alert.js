"use strict";
/**
 * P4-2 评价品质闭环：差评归因词典（纯函数，无 DB 依赖，单测覆盖）。
 *
 * 口径：
 * - 「归因标签」由正文关键词命中得出，可多命中，按词典顺序去重取前 3 个；
 * - 「是否预警」= 星级 ≤ 渠道阈值（默认 2 星）或命中文中已明示的严重项（异物/变质），
 *   后者覆盖「给了 5 星但正文写了头发」这类高星差评，避免漏报。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.REVIEW_ALERT_TAGS = void 0;
exports.detectReviewAlertTags = detectReviewAlertTags;
exports.evaluateReviewAlert = evaluateReviewAlert;
exports.normalizeMaxRating = normalizeMaxRating;
/** 归因标签（顺序即展示优先级）。 */
exports.REVIEW_ALERT_TAGS = [
    '异物',
    '变质',
    '少送漏送',
    '口味差',
    '分量少',
    '不新鲜',
    '变凉',
    '配送慢',
    '包装差',
    '态度差',
];
/** 命中即预警的严重项（与星级无关）。 */
const SEVERE_TAGS = ['异物', '变质'];
/** 词典：标签 → 关键词。只做小写化后的子串匹配（中文无大小写，英文词一并覆盖）。 */
const DICT = [
    {
        tag: '异物',
        words: ['异物', '头发', '虫子', '苍蝇', '钢丝球', '塑料', '玻璃', '石子', '指甲', '蟑螂', '虫', 'hair', 'insect'],
    },
    {
        tag: '变质',
        words: ['变质', '馊', '发酸', '酸味', '过期', '变质了', '臭', '坏了', '不新鲜', 'sour', 'spoiled'],
    },
    {
        tag: '少送漏送',
        words: ['少送', '漏送', '漏了', '少了', '没给', '缺了', '缺一个', '漏发', '少给', '少一份', 'missing'],
    },
    {
        tag: '口味差',
        words: ['难吃', '不好吃', '太咸', '太淡', '没味道', '油腻', '腥', '口味差', '味道差', '齁', 'tasteless', 'too salty'],
    },
    {
        tag: '分量少',
        words: ['分量少', '分量小', '量少', '太少', '不够吃', '缩水', '少得可怜', 'portion'],
    },
    {
        tag: '不新鲜',
        words: ['不新鲜', '隔夜', '剩的', '蔫', '发黄'],
    },
    {
        tag: '变凉',
        words: ['凉了', '凉的', '凉透', '冷了', '不热', '冰凉', '温的', 'cold food'],
    },
    {
        tag: '配送慢',
        words: ['配送慢', '送得慢', '太慢', '超时', '等太久', '等了一小时', '送很久', '迟到', 'delay', 'late'],
    },
    {
        tag: '包装差',
        words: ['包装', '洒了', '撒了', '漏汤', '漏油', '破损', '袋子破', '盒子烂', 'packaging', 'spilled'],
    },
    {
        tag: '态度差',
        words: ['态度', '不理人', '恶劣', '骂人', 'rude', 'attitude'],
    },
];
/** 从正文提取归因标签（最多 3 个，按词典顺序）。 */
function detectReviewAlertTags(content) {
    const text = String(content !== null && content !== void 0 ? content : '').toLowerCase();
    if (!text.trim())
        return [];
    const hits = [];
    for (const { tag, words } of DICT) {
        if (words.some(w => text.includes(w))) {
            hits.push(tag);
            if (hits.length >= 3)
                break;
        }
    }
    return hits;
}
/**
 * 预警判定：星级触阈 或 正文命中严重项。
 * @param rating 星级 1-5
 * @param maxRating 渠道阈值（含），缺省 2
 */
function evaluateReviewAlert(rating, content, maxRating = 2) {
    const tags = detectReviewAlertTags(content);
    const reasons = [];
    const threshold = Number.isFinite(maxRating) ? Math.min(5, Math.max(1, Math.trunc(maxRating))) : 2;
    if (Number.isFinite(rating) && rating <= threshold) {
        reasons.push('low_rating');
    }
    if (tags.some(t => SEVERE_TAGS.includes(t))) {
        reasons.push('severe_tag');
    }
    return { alert: reasons.length > 0, tags, reasons };
}
/** 阈值合法化：1-5 整数，越界回落到 2。 */
function normalizeMaxRating(input) {
    const n = Number(input);
    if (!Number.isFinite(n))
        return 2;
    const i = Math.trunc(n);
    return i >= 1 && i <= 5 ? i : 2;
}
//# sourceMappingURL=review-alert.js.map