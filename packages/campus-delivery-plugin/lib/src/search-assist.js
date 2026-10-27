"use strict";
// P2-2 语音/拍照搜索：识别 Provider 抽象 + 内置 mock 实现。
//
// 目标：把「语音转关键词」「拍照转关键词」收敛成统一接口，C 端只认关键词，
// 后续接入讯飞 / 微信同声传译 / 视觉识别时只需新增一个 provider 实现并放开白名单，
// 不需要改 C 端与 GraphQL 契约。
//
// 本轮只交付 mock：不依赖任何外部服务，结果稳定可复现，便于联调与截图核验。
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEARCH_ASSIST_PROVIDERS = exports.MockSearchAssistProvider = exports.SEARCH_ASSIST_PROVIDER_NAMES = void 0;
exports.normalizeKeywords = normalizeKeywords;
/** 服务商白名单：none = 入口关闭；其余需在 SEARCH_ASSIST_PROVIDERS 中注册 */
exports.SEARCH_ASSIST_PROVIDER_NAMES = ['mock', 'none'];
/** mock 词库：与外卖常见品类重合，命中率高，便于人工核验搜索结果 */
const MOCK_VOCAB = ['宫保鸡丁', '香菇滑鸡饭', '麻辣烫', '炸鸡', '汉堡', '奶茶', '水果捞', '米饭', '凉拌黄瓜', '可乐'];
/** 关键词清洗：去空白、去重、限量，避免超长/空词污染搜索 */
function normalizeKeywords(raw, limit = 4) {
    const list = Array.isArray(raw) ? raw : [];
    const out = [];
    for (const item of list) {
        const kw = String(item !== null && item !== void 0 ? item : '').trim().replace(/\s+/g, ' ');
        if (!kw || kw.length > 20)
            continue;
        if (!out.includes(kw))
            out.push(kw);
        if (out.length >= limit)
            break;
    }
    return out;
}
/** 稳定哈希：同一 payload 每次返回同一组关键词，截图与回归可对齐 */
function hashOf(text) {
    let h = 0;
    for (let i = 0; i < text.length; i += 1)
        h = (h * 31 + text.charCodeAt(i)) % 100000;
    return h;
}
/**
 * payload 是否是可当文本用的内容（非 URL / base64 / 本地文件路径）。
 * 小程序临时文件（wxfile://...）、H5 blob 地址、系统路径都不能当识别文本，
 * 否则文件名会被当成关键词填进搜索框。
 */
function textPayload(payload) {
    const s = String(payload !== null && payload !== void 0 ? payload : '').trim();
    if (!s || s.length > 40)
        return null;
    if (s.includes('://') || /^(data:|blob:|file:)/i.test(s))
        return null;
    if (/[\\/]/.test(s))
        return null;
    if (/\.(png|jpe?g|gif|webp|bmp|mp3|wav|m4a|aac|amr|silk)$/i.test(s))
        return null;
    return s;
}
/**
 * 内置 mock：模拟 ASR/OCR 的返回。
 * - payload 是可读文本 → 按分隔符切词（模拟「听到/看到什么就返回什么」）；
 * - 否则（URL/base64/空）→ 用 payload 哈希从词库取 1–2 个词，保证同一输入结果稳定。
 */
class MockSearchAssistProvider {
    constructor() {
        this.name = 'mock';
    }
    async recognize(input) {
        var _a;
        const text = textPayload(input.payload);
        if (text) {
            const keywords = normalizeKeywords(text.split(/[,，、;；\s]+/));
            return { text, keywords };
        }
        const seed = hashOf(`${input.type}:${(_a = input.payload) !== null && _a !== void 0 ? _a : ''}`);
        const first = MOCK_VOCAB[seed % MOCK_VOCAB.length];
        const keywords = seed % 3 === 0 ? [first] : [first, MOCK_VOCAB[(seed + 3) % MOCK_VOCAB.length]];
        return { text: keywords.join(' '), keywords: normalizeKeywords(keywords) };
    }
}
exports.MockSearchAssistProvider = MockSearchAssistProvider;
/** 注册表：新增真实 provider 时在此登记，并按白名单校验保存值 */
exports.SEARCH_ASSIST_PROVIDERS = {
    mock: new MockSearchAssistProvider(),
};
//# sourceMappingURL=search-assist.js.map