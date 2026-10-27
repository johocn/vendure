// P2-2 语音/拍照搜索：识别 Provider 抽象 + 内置 mock 实现。
//
// 目标：把「语音转关键词」「拍照转关键词」收敛成统一接口，C 端只认关键词，
// 后续接入讯飞 / 微信同声传译 / 视觉识别时只需新增一个 provider 实现并放开白名单，
// 不需要改 C 端与 GraphQL 契约。
//
// 本轮只交付 mock：不依赖任何外部服务，结果稳定可复现，便于联调与截图核验。

export type SearchAssistType = 'voice' | 'image';

export interface SearchAssistInput {
    type: SearchAssistType;
    /** 音频/图片地址或文本（mock 可忽略；真实 provider 用其做 ASR / OCR） */
    payload?: string | null;
}

export interface SearchAssistOutput {
    /** 识别出的整句文本（可能为空，仅用于回显） */
    text: string;
    /** 可直接用于站内搜索的关键词（已去重、去空白） */
    keywords: string[];
}

export interface SearchAssistProvider {
    readonly name: string;
    recognize(input: SearchAssistInput): Promise<SearchAssistOutput>;
}

/** 服务商白名单：none = 入口关闭；其余需在 SEARCH_ASSIST_PROVIDERS 中注册 */
export const SEARCH_ASSIST_PROVIDER_NAMES = ['mock', 'none'] as const;

/** mock 词库：与外卖常见品类重合，命中率高，便于人工核验搜索结果 */
const MOCK_VOCAB = ['宫保鸡丁', '香菇滑鸡饭', '麻辣烫', '炸鸡', '汉堡', '奶茶', '水果捞', '米饭', '凉拌黄瓜', '可乐'];

/** 关键词清洗：去空白、去重、限量，避免超长/空词污染搜索 */
export function normalizeKeywords(raw: unknown, limit = 4): string[] {
    const list = Array.isArray(raw) ? raw : [];
    const out: string[] = [];
    for (const item of list) {
        const kw = String(item ?? '').trim().replace(/\s+/g, ' ');
        if (!kw || kw.length > 20) continue;
        if (!out.includes(kw)) out.push(kw);
        if (out.length >= limit) break;
    }
    return out;
}

/** 稳定哈希：同一 payload 每次返回同一组关键词，截图与回归可对齐 */
function hashOf(text: string): number {
    let h = 0;
    for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) % 100000;
    return h;
}

/**
 * payload 是否是可当文本用的内容（非 URL / base64 / 本地文件路径）。
 * 小程序临时文件（wxfile://...）、H5 blob 地址、系统路径都不能当识别文本，
 * 否则文件名会被当成关键词填进搜索框。
 */
function textPayload(payload?: string | null): string | null {
    const s = String(payload ?? '').trim();
    if (!s || s.length > 40) return null;
    if (s.includes('://') || /^(data:|blob:|file:)/i.test(s)) return null;
    if (/[\\/]/.test(s)) return null;
    if (/\.(png|jpe?g|gif|webp|bmp|mp3|wav|m4a|aac|amr|silk)$/i.test(s)) return null;
    return s;
}

/**
 * 内置 mock：模拟 ASR/OCR 的返回。
 * - payload 是可读文本 → 按分隔符切词（模拟「听到/看到什么就返回什么」）；
 * - 否则（URL/base64/空）→ 用 payload 哈希从词库取 1–2 个词，保证同一输入结果稳定。
 */
export class MockSearchAssistProvider implements SearchAssistProvider {
    readonly name = 'mock';

    async recognize(input: SearchAssistInput): Promise<SearchAssistOutput> {
        const text = textPayload(input.payload);
        if (text) {
            const keywords = normalizeKeywords(text.split(/[,，、;；\s]+/));
            return { text, keywords };
        }
        const seed = hashOf(`${input.type}:${input.payload ?? ''}`);
        const first = MOCK_VOCAB[seed % MOCK_VOCAB.length];
        const keywords = seed % 3 === 0 ? [first] : [first, MOCK_VOCAB[(seed + 3) % MOCK_VOCAB.length]];
        return { text: keywords.join(' '), keywords: normalizeKeywords(keywords) };
    }
}

/** 注册表：新增真实 provider 时在此登记，并按白名单校验保存值 */
export const SEARCH_ASSIST_PROVIDERS: Record<string, SearchAssistProvider> = {
    mock: new MockSearchAssistProvider(),
};
