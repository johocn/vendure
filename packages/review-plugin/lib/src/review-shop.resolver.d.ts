import { ID, RequestContext } from '@vendure/core';
import { Review } from './review.entity';
import { ReviewService } from './review.service';
export declare class ReviewShopResolver {
    private reviewService;
    constructor(reviewService: ReviewService);
    productReviews(ctx: RequestContext, productId: ID, options: any): Promise<any>;
    myReviews(ctx: RequestContext): Promise<any>;
    reviewStats(ctx: RequestContext, productId: ID): Promise<any>;
    /** 店铺级评论流：当前渠道全部 approved 主评（menu 评论 tab 数据源）。 */
    channelReviews(ctx: RequestContext, options: any): Promise<any>;
    /** 店铺级统计：当前渠道全店 approved 主评（摘要卡）。 */
    channelReviewStats(ctx: RequestContext): Promise<any>;
    productRating(ctx: RequestContext, productId: ID): Promise<any>;
    createReview(ctx: RequestContext, input: any): Promise<any>;
    updateReview(ctx: RequestContext, id: ID, input: any): Promise<any>;
    deleteReview(ctx: RequestContext, id: ID): Promise<any>;
    createFollowUpReview(ctx: RequestContext, reviewId: ID, input: any): Promise<any>;
    markReviewHelpful(ctx: RequestContext, id: ID): Promise<any>;
    followUps(ctx: RequestContext, review: Review): Promise<any>;
    customerName(ctx: RequestContext, review: Review): Promise<string | null>;
}
