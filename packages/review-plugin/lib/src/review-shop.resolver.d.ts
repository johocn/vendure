import { ID, RequestContext } from '@vendure/core';
import { Review } from './review.entity';
import { ReviewService } from './review.service';
export declare class ReviewShopResolver {
    private reviewService;
    constructor(reviewService: ReviewService);
    productReviews(ctx: RequestContext, productId: ID, options: any): Promise<any>;
    myReviews(ctx: RequestContext): Promise<any>;
    reviewStats(ctx: RequestContext, productId: ID): Promise<any>;
    createReview(ctx: RequestContext, input: any): Promise<any>;
    markReviewHelpful(ctx: RequestContext, id: ID): Promise<any>;
    customerName(ctx: RequestContext, review: Review): Promise<string | null>;
}
