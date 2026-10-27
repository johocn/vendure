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
export declare const SEARCH_ASSIST_PROVIDER_NAMES: readonly ["mock", "none"];
/** 关键词清洗：去空白、去重、限量，避免超长/空词污染搜索 */
export declare function normalizeKeywords(raw: unknown, limit?: number): string[];
/**
 * 内置 mock：模拟 ASR/OCR 的返回。
 * - payload 是可读文本 → 按分隔符切词（模拟「听到/看到什么就返回什么」）；
 * - 否则（URL/base64/空）→ 用 payload 哈希从词库取 1–2 个词，保证同一输入结果稳定。
 */
export declare class MockSearchAssistProvider implements SearchAssistProvider {
    readonly name = "mock";
    recognize(input: SearchAssistInput): Promise<SearchAssistOutput>;
}
/** 注册表：新增真实 provider 时在此登记，并按白名单校验保存值 */
export declare const SEARCH_ASSIST_PROVIDERS: Record<string, SearchAssistProvider>;
