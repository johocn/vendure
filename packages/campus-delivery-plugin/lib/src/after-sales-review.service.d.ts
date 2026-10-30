import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
/** 满意度评分（§93）：顾客对退款处理打 1-5 分 */
export interface MerchantAfterSalesReviewBucket {
    score: number;
    count: number;
}
/** 低分待跟进项（§93）：score <= 2 */
export interface MerchantAfterSalesLowReview {
    id: string;
    requestId: string;
    orderCode: string;
    customerName: string | null;
    score: number;
    comment: string | null;
    followedUp: boolean;
    createdAt: Date;
}
/** 退款后满意度汇总（§93） */
export interface MerchantAfterSalesReviewSummary {
    total: number;
    /** 平均分（保留 1 位小数，无评分为 0） */
    avgScore: number;
    /** 1-5 分档人数（固定 5 项，按分数升序） */
    distribution: MerchantAfterSalesReviewBucket[];
    /** 低分（<=2）条数 */
    lowScoreCount: number;
    /** 低分待跟进明细（最近 20 条，含已跟进） */
    lowScores: MerchantAfterSalesLowReview[];
}
/** 售后满意度回访（§93）：顾客提交评分 / 商家汇总与低分跟进 */
export declare class AfterSalesReviewService {
    private connection;
    constructor(connection: TransactionalConnection);
    /** 顾客提交评分（§93）：仅本人且已退款完成的售后单，重复提交覆盖旧评分 */
    submit(ctx: RequestContext, requestId: ID, score: number, comment?: string | null): Promise<{
        ok: boolean;
        score: number;
    }>;
    /** 满意度汇总（§93）：区间内均分/分档/低分待跟进，最长一年 */
    summary(ctx: RequestContext, from: string, to: string): Promise<MerchantAfterSalesReviewSummary>;
    /** 标记低分已跟进（§93）：仅本店渠道记录 */
    markFollowed(ctx: RequestContext, id: ID): Promise<boolean>;
    /** 兼容不同驱动的返回结构：部分驱动把结果再包一层数组 */
    private rows;
}
