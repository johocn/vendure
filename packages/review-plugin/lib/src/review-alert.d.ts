/**
 * P4-2 评价品质闭环：差评归因词典（纯函数，无 DB 依赖，单测覆盖）。
 *
 * 口径：
 * - 「归因标签」由正文关键词命中得出，可多命中，按词典顺序去重取前 3 个；
 * - 「是否预警」= 星级 ≤ 渠道阈值（默认 2 星）或命中文中已明示的严重项（异物/变质），
 *   后者覆盖「给了 5 星但正文写了头发」这类高星差评，避免漏报。
 */
/** 归因标签（顺序即展示优先级）。 */
export declare const REVIEW_ALERT_TAGS: readonly ["异物", "变质", "少送漏送", "口味差", "分量少", "不新鲜", "变凉", "配送慢", "包装差", "态度差"];
export type ReviewAlertTag = (typeof REVIEW_ALERT_TAGS)[number];
/** 从正文提取归因标签（最多 3 个，按词典顺序）。 */
export declare function detectReviewAlertTags(content?: string | null): ReviewAlertTag[];
export interface ReviewAlertDecision {
    /** 是否需要生成预警 */
    alert: boolean;
    /** 归因标签 */
    tags: ReviewAlertTag[];
    /** 触发原因：low_rating（星级触阈）/ severe_tag（正文严重项） */
    reasons: Array<'low_rating' | 'severe_tag'>;
}
/**
 * 预警判定：星级触阈 或 正文命中严重项。
 * @param rating 星级 1-5
 * @param maxRating 渠道阈值（含），缺省 2
 */
export declare function evaluateReviewAlert(rating: number, content?: string | null, maxRating?: number): ReviewAlertDecision;
/** 阈值合法化：1-5 整数，越界回落到 2。 */
export declare function normalizeMaxRating(input: unknown): number;
