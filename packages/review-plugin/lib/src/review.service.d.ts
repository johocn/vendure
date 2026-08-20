import { CustomerService, ID, ListQueryBuilder, PaginatedList, ProductService, RequestContext, TransactionalConnection } from '@vendure/core';
import { Review } from './review.entity';
import { ReviewPluginOptions } from './types';
import { CreateReviewInput, FollowUpReviewInput, ProductRating, ReviewListOptions, ReviewStats, UpdateReviewInput } from './types';
export declare class ReviewService {
    private options;
    private connection;
    private listQueryBuilder;
    private customerService;
    private productService;
    constructor(options: ReviewPluginOptions | undefined, connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, customerService: CustomerService, productService: ProductService);
    createReview(ctx: RequestContext, input: CreateReviewInput): Promise<Review>;
    /** 追评：挂在本人主评（parentId）下，聚合不计入。 */
    createFollowUpReview(ctx: RequestContext, reviewId: ID, input: FollowUpReviewInput): Promise<Review>;
    /** 修改本人评价：仅 pending/approved 可改；变更涉及已审核主评时重算评分聚合。 */
    updateReview(ctx: RequestContext, id: ID, input: UpdateReviewInput): Promise<Review>;
    /** 删除本人评价（软删）。已审核主评删除后剔除聚合。 */
    deleteReview(ctx: RequestContext, id: ID): Promise<boolean>;
    replyReview(ctx: RequestContext, id: ID, reply: string): Promise<Review>;
    approveReview(ctx: RequestContext, id: ID): Promise<Review>;
    rejectReview(ctx: RequestContext, id: ID): Promise<Review>;
    getReview(ctx: RequestContext, id: ID): Promise<Review>;
    getReviews(ctx: RequestContext, options?: ReviewListOptions): Promise<PaginatedList<Review>>;
    /** C 端商品列表：仅对外可见（approved）的主评 + 追评（followUps 由 ResolveField 加载）。 */
    getProductReviews(ctx: RequestContext, productId: ID, options?: ReviewListOptions): Promise<PaginatedList<Review>>;
    getMyReviews(ctx: RequestContext): Promise<Review[]>;
    getReviewFollowUps(ctx: RequestContext, review: Review): Promise<Review[]>;
    getReviewStats(ctx: RequestContext, productId: ID): Promise<ReviewStats>;
    markHelpful(ctx: RequestContext, id: ID): Promise<Review>;
    /** 读取聚合到 Product 自定义字段的评分快照（供列表卡片直接展示，避免全表扫描）。 */
    getProductRating(ctx: RequestContext, productId: ID): Promise<ProductRating>;
    /** 重算商品评风聚合（approved 主评）并写回 Product.customFields。 */
    recomputeProductRating(ctx: RequestContext, productId: number): Promise<void>;
    getCustomerName(ctx: RequestContext, review: Review): Promise<string | null>;
    private assertContent;
    private requireCustomer;
}
