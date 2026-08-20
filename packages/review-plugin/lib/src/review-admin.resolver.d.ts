import { ID, RequestContext } from '@vendure/core';
import { Review } from './review.entity';
import { ReviewService } from './review.service';
export declare class ReviewAdminResolver {
    private reviewService;
    constructor(reviewService: ReviewService);
    reviews(ctx: RequestContext, options: any): Promise<any>;
    review(ctx: RequestContext, id: ID): Promise<any>;
    reviewStats(ctx: RequestContext, productId: ID): Promise<any>;
    productRating(ctx: RequestContext, productId: ID): Promise<any>;
    replyReview(ctx: RequestContext, id: ID, reply: string): Promise<any>;
    approveReview(ctx: RequestContext, id: ID): Promise<any>;
    rejectReview(ctx: RequestContext, id: ID): Promise<any>;
    followUps(ctx: RequestContext, review: Review): Promise<any>;
    customerName(ctx: RequestContext, review: Review): Promise<string | null>;
}
