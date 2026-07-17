import { CustomerService, ID, ListQueryBuilder, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { Review } from './review.entity';
import { CreateReviewInput, ReviewListOptions, ReviewStats } from './types';
export declare class ReviewService {
    private connection;
    private listQueryBuilder;
    private customerService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, customerService: CustomerService);
    createReview(ctx: RequestContext, input: CreateReviewInput): Promise<Review>;
    replyReview(ctx: RequestContext, id: ID, reply: string): Promise<Review>;
    approveReview(ctx: RequestContext, id: ID): Promise<Review>;
    rejectReview(ctx: RequestContext, id: ID): Promise<Review>;
    getReview(ctx: RequestContext, id: ID): Promise<Review>;
    getReviews(ctx: RequestContext, options?: ReviewListOptions): Promise<PaginatedList<Review>>;
    getProductReviews(ctx: RequestContext, productId: ID, options?: ReviewListOptions): Promise<PaginatedList<Review>>;
    getMyReviews(ctx: RequestContext): Promise<Review[]>;
    getReviewStats(ctx: RequestContext, productId: ID): Promise<ReviewStats>;
    markHelpful(ctx: RequestContext, id: ID): Promise<Review>;
    getCustomerName(ctx: RequestContext, review: Review): Promise<string | null>;
}
