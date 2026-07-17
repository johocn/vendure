import { Injectable } from '@nestjs/common';
import {
    CustomerService,
    EntityNotFoundError,
    ForbiddenError,
    ID,
    ListQueryBuilder,
    Logger,
    Order,
    OrderLine,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
    UnauthorizedError,
    UserInputError,
} from '@vendure/core';

import { loggerCtx } from './constants';
import { Review } from './review.entity';
import {
    CreateReviewInput,
    RatingCount,
    ReviewListOptions,
    ReviewStats,
    TagCount,
} from './types';

const ALLOWED_ORDER_STATES = ['Delivered', 'Completed'];

@Injectable()
export class ReviewService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private customerService: CustomerService,
    ) {}

    async createReview(ctx: RequestContext, input: CreateReviewInput): Promise<Review> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new EntityNotFoundError('Customer', ctx.activeUserId);
        }

        if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
            throw new UserInputError('rating must be an integer between 1 and 5');
        }
        if (!input.content || !input.content.trim()) {
            throw new UserInputError('content must not be empty');
        }
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

        const review = new Review({
            customerId: customer.id,
            productId: Number(input.productId),
            orderLineId: Number(input.orderLineId),
            variantId: input.variantId ? Number(input.variantId) : null,
            rating: input.rating,
            content: input.content,
            images: input.images ?? null,
            videos: input.videos ?? null,
            tags: input.tags ?? null,
            isAnonymous: input.isAnonymous ?? false,
            status: 'pending',
        } as any);
        review.channels = [ctx.channel];
        const saved = await reviewRepo.save(review);
        Logger.info(`Review created by customer ${customer.id} for product ${input.productId}`, loggerCtx);
        return saved;
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
        review.status = 'approved';
        return this.connection.getRepository(ctx, Review).save(review);
    }

    async rejectReview(ctx: RequestContext, id: ID): Promise<Review> {
        const review = await this.connection.getEntityOrThrow(ctx, Review, id);
        review.status = 'rejected';
        return this.connection.getRepository(ctx, Review).save(review);
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

    async getProductReviews(
        ctx: RequestContext,
        productId: ID,
        options?: ReviewListOptions,
    ): Promise<PaginatedList<Review>> {
        return this.listQueryBuilder
            .build(Review, options, {
                ctx,
                relations: ['channels'],
                channelId: ctx.channelId,
                where: {
                    productId: Number(productId),
                    status: 'approved',
                },
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async getMyReviews(ctx: RequestContext): Promise<Review[]> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return this.connection
            .getRepository(ctx, Review)
            .find({
                where: { customerId: customer.id } as any,
                order: { createdAt: 'DESC' },
            });
    }

    async getReviewStats(ctx: RequestContext, productId: ID): Promise<ReviewStats> {
        const repo = this.connection.getRepository(ctx, Review);
        const reviews = await repo.find({
            where: { productId: Number(productId), status: 'approved' } as any,
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
        const review = await this.connection.getEntityOrThrow(ctx, Review, id, {
            where: { status: 'approved' } as any,
        });
        review.helpfulCount += 1;
        return this.connection.getRepository(ctx, Review).save(review);
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
}
