/** 反馈列表查询参数（shop 端不含 status）。 */
export interface FeedbackListOptions {
    skip?: number;
    take?: number;
    status?: string;
}
/** FAQ 列表查询参数。 */
export interface FaqListOptions {
    skip?: number;
    take?: number;
}
export interface CreateFeedbackInput {
    type?: string;
    title: string;
    content: string;
    imgs?: string[] | null;
    contactWay?: string | null;
}
export interface SaveFaqInput {
    id?: string;
    title: string;
    content: string;
    type?: string;
    sort?: number;
    enabled?: boolean;
    /** 多语言覆盖（JSON）；zh-CN 值与 title/content 基线同值 */
    titleI18n?: Record<string, string> | null;
    contentI18n?: Record<string, string> | null;
}
/** 内容多语言 C 端直传的 locale 白名单（避开 Vendure LanguageCode 映射坑） */
export declare const CONTENT_LOCALES: readonly ["zh-CN", "zh-TW", "en", "ja", "ko"];
export type ContentLocale = (typeof CONTENT_LOCALES)[number];
