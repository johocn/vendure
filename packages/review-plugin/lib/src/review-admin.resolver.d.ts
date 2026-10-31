import { ID, RequestContext } from '@vendure/core';
import { Review } from './review.entity';
import { ReviewService } from './review.service';
export declare class ReviewAdminResolver {
    private reviewService;
    constructor(reviewService: ReviewService);
    reviews(ctx: RequestContext, options: any): Promise<any>;
    review(ctx: RequestContext, id: ID): Promise<any>;
    reviewStats(ctx: RequestContext, productId: ID): Promise<any>;
    /** 差评申诉列表（P0-4）：status 传申诉状态，缺省列出全部有申诉的评价 */
    reviewAppeals(ctx: RequestContext, options: any): Promise<any>;
    productRating(ctx: RequestContext, productId: ID): Promise<any>;
    replyReview(ctx: RequestContext, id: ID, reply: string): Promise<any>;
    approveReview(ctx: RequestContext, id: ID): Promise<any>;
    rejectReview(ctx: RequestContext, id: ID): Promise<any>;
    /** 差评申诉通过：评价隐藏并退出评分聚合 */
    approveReviewAppeal(ctx: RequestContext, id: ID, note?: string): Promise<any>;
    /** 差评申诉驳回：评价维持原状，仅留痕 */
    rejectReviewAppeal(ctx: RequestContext, id: ID, note?: string): Promise<any>;
    /** 撤销申诉通过：评价恢复展示并重新计入评分聚合 */
    revokeReviewAppeal(ctx: RequestContext, id: ID, note?: string): Promise<any>;
    followUps(ctx: RequestContext, review: Review): Promise<any>;
    customerName(ctx: RequestContext, review: Review): Promise<string | null>;
}
