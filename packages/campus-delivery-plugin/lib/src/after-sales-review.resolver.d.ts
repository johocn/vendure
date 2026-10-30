import { ID, RequestContext } from '@vendure/core';
import { AfterSalesReviewService } from './after-sales-review.service';
/** 商家端：退款后满意度汇总与低分跟进（§93） */
export declare class AfterSalesReviewAdminResolver {
    private reviews;
    constructor(reviews: AfterSalesReviewService);
    /** 满意度汇总（§93）：区间内均分/分档/低分待跟进 */
    campusMerchantAfterSalesReviewSummary(ctx: RequestContext, from: string, to: string): Promise<import("./after-sales-review.service").MerchantAfterSalesReviewSummary>;
    /** 标记低分已跟进（§93） */
    campusMerchantAfterSalesReviewFollowUp(ctx: RequestContext, id: ID): Promise<boolean>;
}
/** C 端：退款完成后邀请顾客评分（§93） */
export declare class AfterSalesReviewShopResolver {
    private reviews;
    constructor(reviews: AfterSalesReviewService);
    campusSubmitAfterSalesReview(ctx: RequestContext, requestId: ID, score: number, comment?: string | null): Promise<{
        ok: boolean;
        score: number;
    }>;
}
