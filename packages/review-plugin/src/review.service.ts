import { Inject, Injectable, Optional } from '@nestjs/common';
import {
    CustomerService,
    EntityNotFoundError,
    ForbiddenError,
    ID,
    ListQueryBuilder,
    Logger,
    OrderLine,
    PaginatedList,
    ProductService,
    RequestContext,
    TransactionalConnection,
    UnauthorizedError,
    UserInputError,
} from '@vendure/core';

import { loggerCtx, REVIEW_PLUGIN_OPTIONS } from './constants';
import { Review } from './review.entity';
import { ReviewPluginOptions } from './types';
import { IsNull } from 'typeorm';
import {
    CreateReviewInput,
    FollowUpReviewInput,
    ProductRating,
    RatingCount,
    ReviewListOptions,
    ReviewStats,
    TagCount,
    UpdateReviewInput,
} from './types';

const ALLOWED_ORDER_STATES = ['Delivered', 'Completed'];
/** 对外可见且计入评分聚合的状态。 */
const VISIBLE_STATUS = 'approved';
const DELETED_STATUS = 'deleted';

@Injectable()
export class ReviewService {
    constructor(
        @Optional() @Inject(REVIEW_PLUGIN_OPTIONS) private options: ReviewPluginOptions = {},
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private customerService: CustomerService,
        private productService: ProductService,
    ) {}

    async createReview(ctx: RequestContext, input: CreateReviewInput): Promise<Review> {
        const customer = await this.requireCustomer(ctx);
        if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
            throw new UserInputError('rating must be an integer between 1 and 5');
        }
        this.assertContent(input.content);
        if (!input.orderLineId) {
            throw new UserInputError('orderLineId is required to create a review');
        }

        const orderLineRepo = this.connection.getRepository(ctx, OrderLine);
        const orderLine = await orderLineRepo.findOne({
            where: { id: Number(input.orderLineId) } as any,
            relations: ['order', 'order.customer'],
        });
        if (!orderLine || !orderLine.order) {
            throw new EntityNotFoundError('OrderLine', input.orderLineId);
        }
        const order = orderLine.order;
        if (!order.customer || order.customer.id !== customer.id) {
            throw new ForbiddenError();
        }
        if (!ALLOWED_ORDER_STATES.includes(order.state)) {
            throw new UserInputError('Order must be delivered before reviewing');
        }

        const reviewRepo = this.connection.getRepository(ctx, Review);
        const existing = await reviewRepo.findOne({
            where: {
                orderLineId: Number(input.orderLineId),
                customerId: customer.id,
            } as any,
        });
        if (existing) {
            throw new UserInputError('You have already reviewed this order line');
        }

        const status = this.options.autoApprove ? VISIBLE_STATUS : 'pending';
        const review = new Review({
            customerId: customer.id,
            productId: Number(input.productId),
            orderLineId: Number(input.orderLineId),
            variantId: input.variantId ? Number(input.variantId) : null,
            rating: input.rating,
            content: input.content.trim(),
            images: input.images ?? null,
            videos: input.videos ?? null,
            tags: input.tags ?? null,
            isAnonymous: input.isAnonymous ?? false,
            status,
            channelId: ctx.channelId as number,
        } as any);
        review.channels = [ctx.channel];
        const saved = await reviewRepo.save(review);
        if (status === VISIBLE_STATUS) {
            await this.recomputeProductRating(ctx, Number(input.productId));
        }
        Logger.info(
            `Review created by customer ${customer.id} for product ${input.productId}`,
            loggerCtx,
        );
        return saved;
    }

    /** 追评：挂在本人主评（parentId）下，聚合不计入。 */
    async createFollowUpReview(
        ctx: RequestContext,
        reviewId: ID,
        input: FollowUpReviewInput,
    ): Promise<Review> {
        const customer = await this.requireCustomer(ctx);
        const reviewRepo = this.connection.getRepository(ctx, Review);
        const parent = await reviewRepo.findOne({ where: { id: Number(reviewId) } as any });
        if (!parent) {
            throw new EntityNotFoundError('Review', reviewId);
        }
        if (parent.customerId !== customer.id) {
            throw new ForbiddenError();
        }
        if (parent.status === DELETED_STATUS) {
            throw new UserInputError('Cannot add a follow-up to a deleted review');
        }
        if (parent.parentId != null) {
            throw new UserInputError('Cannot add a follow-up to a follow-up');
        }
        if (input.content != null) {
            this.assertContent(input.content);
        }
        if (input.rating != null && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)) {
            throw new UserInputError('rating must be an integer between 1 and 5');
        }

        const followUp = new Review({
            customerId: customer.id,
            productId: parent.productId,
            orderLineId: parent.orderLineId,
            variantId: parent.variantId,
            rating: input.rating ?? parent.rating,
            content: (input.content ?? '').trim(),
            images: input.images ?? null,
            videos: input.videos ?? null,
            tags: input.tags ?? null,
            isAnonymous: input.isAnonymous ?? parent.isAnonymous,
            status: this.options.autoApprove ? VISIBLE_STATUS : 'pending',
            parentId: parent.id as number,
            channelId: ctx.channelId as number,
        } as any);
        followUp.channels = [ctx.channel];
        return reviewRepo.save(followUp);
    }

    /** 修改本人评价：仅 pending/approved 可改；变更涉及已审核主评时重算评分聚合。 */
    async updateReview(ctx: RequestContext, id: ID, input: UpdateReviewInput): Promise<Review> {
        const customer = await this.requireCustomer(ctx);
        const review = await this.connection.getEntityOrThrow(ctx, Review, id);
        if (review.customerId !== customer.id) {
            throw new ForbiddenError();
        }
        if (review.status !== 'pending' && review.status !== VISIBLE_STATUS) {
            throw new UserInputError('Only pending or approved reviews can be updated');
        }
        if (input.content != null) {
            this.assertContent(input.content);
            review.content = input.content.trim();
        }
        if (input.rating != null) {
            if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
                throw new UserInputError('rating must be an integer between 1 and 5');
            }
            // 追评无独立评分聚合，改评风仅主评生效
            if (!review.parentId) {
                review.rating = input.rating;
            }
        }
        if (input.images !== undefined) review.images = input.images;
        if (input.videos !== undefined) review.videos = input.videos;
        if (input.tags !== undefined) review.tags = input.tags;
        if (input.isAnonymous !== undefined) review.isAnonymous = input.isAnonymous;

        const wasApprovedRoot = review.status === VISIBLE_STATUS && !review.parentId;
        const saved = await this.connection.getRepository(ctx, Review).save(review);
        if (wasApprovedRoot) {
            await this.recomputeProductRating(ctx, saved.productId);
        }
        return saved;
    }

    /** 删除本人评价（软删）。已审核主评删除后剔除聚合。 */
    async deleteReview(ctx: RequestContext, id: ID): Promise<boolean> {
        const customer = await this.requireCustomer(ctx);
        const review = await this.connection.getEntityOrThrow(ctx, Review, id);
        if (review.customerId !== customer.id) {
            throw new ForbiddenError();
        }
        if (review.status === DELETED_STATUS) {
            return true;
        }
        const wasApprovedRoot = review.status === VISIBLE_STATUS && !review.parentId;
        review.status = DELETED_STATUS;
        const saved = await this.connection.getRepository(ctx, Review).save(review);
        if (wasApprovedRoot) {
            await this.recomputeProductRating(ctx, saved.productId);
        }
        return true;
    }

    async replyReview(ctx: RequestContext, id: ID, reply: string): Promise<Review> {
        if (!reply || !reply.trim()) {
            throw new UserInputError('reply must not be empty');
        }
        const review = await this.connection.getEntityOrThrow(ctx, Review, id);
        review.reply = reply;
        review.repliedAt = new Date();
        return this.connection.getRepository(ctx, Review).save(review);
    }

    async approveReview(ctx: RequestContext, id: ID): Promise<Review> {
        const review = await this.connection.getEntityOrThrow(ctx, Review, id);
        review.status = VISIBLE_STATUS;
        const saved = await this.connection.getRepository(ctx, Review).save(review);
        if (!review.parentId) {
            await this.recomputeProductRating(ctx, saved.productId);
        }
        return saved;
    }

    async rejectReview(ctx: RequestContext, id: ID): Promise<Review> {
        const review = await this.connection.getEntityOrThrow(ctx, Review, id);
        const wasApprovedRoot = review.status === VISIBLE_STATUS && !review.parentId;
        review.status = 'rejected';
        const saved = await this.connection.getRepository(ctx, Review).save(review);
        if (wasApprovedRoot) {
            await this.recomputeProductRating(ctx, saved.productId);
        }
        return saved;
    }

    async getReview(ctx: RequestContext, id: ID): Promise<Review> {
        return this.connection.getEntityOrThrow(ctx, Review, id);
    }

    async getReviews(ctx: RequestContext, options?: ReviewListOptions): Promise<PaginatedList<Review>> {
        const where: any = {};
        if (options?.productId != null) {
            where.productId = Number(options.productId);
        }
        if (options?.status != null) {
            where.status = options.status;
        }
        return this.listQueryBuilder
            .build(Review, options, {
                ctx,
                relations: ['channels'],
                channelId: ctx.channelId,
                where,
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    /** C 端商品列表：仅对外可见（approved）的主评 + 追评（followUps 由 ResolveField 加载）。 */
    async getProductReviews(
        ctx: RequestContext,
        productId: ID,
        options?: ReviewListOptions,
    ): Promise<PaginatedList<Review>> {
        return this.listQueryBuilder
            .build(
                Review,
                { ...options },
                {
                    ctx,
                    relations: ['channels'],
                    channelId: ctx.channelId,
                    where: {
                        productId: Number(productId),
                        status: VISIBLE_STATUS,
                        parentId: IsNull(),
                    } as any,
                },
            )
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async getMyReviews(ctx: RequestContext): Promise<Review[]> {
        const customer = await this.requireCustomer(ctx);
        return this.connection
            .getRepository(ctx, Review)
            .find({
                where: { customerId: customer.id } as any,
                order: { createdAt: 'DESC' },
            });
    }

    async getReviewFollowUps(ctx: RequestContext, review: Review): Promise<Review[]> {
        return this.connection
            .getRepository(ctx, Review)
            .find({
                where: { parentId: review.id, status: VISIBLE_STATUS } as any,
                order: { createdAt: 'ASC' },
            });
    }

    async getReviewStats(ctx: RequestContext, productId: ID): Promise<ReviewStats> {
        const repo = this.connection.getRepository(ctx, Review);
        const reviews = await repo.find({
            where: { productId: Number(productId), status: VISIBLE_STATUS, parentId: IsNull() } as any,
        });
        const totalCount = reviews.length;
        if (totalCount === 0) {
            return {
                totalCount: 0,
                goodRate: 0,
                averageRating: 0,
                ratingDistribution: [1, 2, 3, 4, 5].map(rating => ({ rating, count: 0 })),
                topTags: [],
            };
        }
        const goodCount = reviews.filter(r => r.rating >= 4).length;
        const goodRate = Math.round((goodCount / totalCount) * 1000) / 10;
        const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
        const averageRating = Math.round((sum / totalCount) * 10) / 10;

        const distMap = new Map<number, number>();
        for (const r of reviews) {
            distMap.set(r.rating, (distMap.get(r.rating) ?? 0) + 1);
        }
        const ratingDistribution: RatingCount[] = [1, 2, 3, 4, 5].map(rating => ({
            rating,
            count: distMap.get(rating) ?? 0,
        }));

        const tagMap = new Map<string, number>();
        for (const r of reviews) {
            for (const tag of r.tags ?? []) {
                tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
            }
        }
        const topTags: TagCount[] = [...tagMap.entries()]
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return { totalCount, goodRate, averageRating, ratingDistribution, topTags };
    }

    async markHelpful(ctx: RequestContext, id: ID): Promise<Review> {
        const review = await this.connection.getEntityOrThrow(ctx, Review, id);
        review.helpfulCount += 1;
        return this.connection.getRepository(ctx, Review).save(review);
    }

    /** 读取聚合到 Product 自定义字段的评分快照（供列表卡片直接展示，避免全表扫描）。 */
    async getProductRating(ctx: RequestContext, productId: ID): Promise<ProductRating> {
        const product = await this.productService.findOne(ctx, productId);
        if (!product) {
            throw new EntityNotFoundError('Product', productId);
        }
        const cf = (product.customFields ?? {}) as any;
        return {
            rating: cf.reviewRating ?? 0,
            reviewCount: cf.reviewCount ?? 0,
        };
    }

    /** 重算商品评风聚合（approved 主评）并写回 Product.customFields。 */
    async recomputeProductRating(ctx: RequestContext, productId: number): Promise<void> {
        const reviews = await this.connection.getRepository(ctx, Review).find({
            where: { productId, status: VISIBLE_STATUS, parentId: IsNull() } as any,
        });
        const reviewCount = reviews.length;
        const rating =
            reviewCount === 0
                ? 0
                : Math.round(
                      (reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount) * 10,
                  ) / 10;
        const product = await this.productService.findOne(ctx, productId);
        if (!product) return;
        try {
            await this.productService.update(ctx, {
                id: productId,
                customFields: {
                    ...(product.customFields ?? {}),
                    reviewRating: rating,
                    reviewCount,
                } as any,
            });
        } catch (e: any) {
            Logger.error(
                `Failed to recompute rating for product ${productId}: ${e?.message ?? e}`,
                loggerCtx,
            );
        }
    }

    async getCustomerName(ctx: RequestContext, review: Review): Promise<string | null> {
        if (review.isAnonymous) {
            return null;
        }
        const customer = await this.customerService.findOne(ctx, review.customerId as any);
        if (!customer) {
            return null;
        }
        return [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.emailAddress;
    }

    private assertContent(content: string): void {
        if (content == null || !content.trim()) {
            throw new UserInputError('content must not be empty');
        }
        const minLength = this.options.minContentLength ?? 0;
        if (minLength > 0 && content.trim().length < minLength) {
            throw new UserInputError(`content must be at least ${minLength} characters`);
        }
    }

    private async requireCustomer(ctx: RequestContext): Promise<any> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return customer;
    }
}