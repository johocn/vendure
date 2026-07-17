"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const review_entity_1 = require("./review.entity");
const ALLOWED_ORDER_STATES = ['Delivered', 'Completed'];
let ReviewService = class ReviewService {
    constructor(connection, listQueryBuilder, customerService) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.customerService = customerService;
    }
    async createReview(ctx, input) {
        var _a, _b, _c, _d;
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.EntityNotFoundError('Customer', ctx.activeUserId);
        }
        if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
            throw new core_1.UserInputError('rating must be an integer between 1 and 5');
        }
        if (!input.content || !input.content.trim()) {
            throw new core_1.UserInputError('content must not be empty');
        }
        if (!input.orderLineId) {
            throw new core_1.UserInputError('orderLineId is required to create a review');
        }
        const orderLineRepo = this.connection.getRepository(ctx, core_1.OrderLine);
        const orderLine = await orderLineRepo.findOne({
            where: { id: Number(input.orderLineId) },
            relations: ['order', 'order.customer'],
        });
        if (!orderLine || !orderLine.order) {
            throw new core_1.EntityNotFoundError('OrderLine', input.orderLineId);
        }
        const order = orderLine.order;
        if (!order.customer || order.customer.id !== customer.id) {
            throw new core_1.ForbiddenError();
        }
        if (!ALLOWED_ORDER_STATES.includes(order.state)) {
            throw new core_1.UserInputError('Order must be delivered before reviewing');
        }
        const reviewRepo = this.connection.getRepository(ctx, review_entity_1.Review);
        const existing = await reviewRepo.findOne({
            where: {
                orderLineId: Number(input.orderLineId),
                customerId: customer.id,
            },
        });
        if (existing) {
            throw new core_1.UserInputError('You have already reviewed this order line');
        }
        const review = new review_entity_1.Review({
            customerId: customer.id,
            productId: Number(input.productId),
            orderLineId: Number(input.orderLineId),
            variantId: input.variantId ? Number(input.variantId) : null,
            rating: input.rating,
            content: input.content,
            images: (_a = input.images) !== null && _a !== void 0 ? _a : null,
            videos: (_b = input.videos) !== null && _b !== void 0 ? _b : null,
            tags: (_c = input.tags) !== null && _c !== void 0 ? _c : null,
            isAnonymous: (_d = input.isAnonymous) !== null && _d !== void 0 ? _d : false,
            status: 'pending',
        });
        review.channels = [ctx.channel];
        const saved = await reviewRepo.save(review);
        core_1.Logger.info(`Review created by customer ${customer.id} for product ${input.productId}`, constants_1.loggerCtx);
        return saved;
    }
    async replyReview(ctx, id, reply) {
        if (!reply || !reply.trim()) {
            throw new core_1.UserInputError('reply must not be empty');
        }
        const review = await this.connection.getEntityOrThrow(ctx, review_entity_1.Review, id);
        review.reply = reply;
        review.repliedAt = new Date();
        return this.connection.getRepository(ctx, review_entity_1.Review).save(review);
    }
    async approveReview(ctx, id) {
        const review = await this.connection.getEntityOrThrow(ctx, review_entity_1.Review, id);
        review.status = 'approved';
        return this.connection.getRepository(ctx, review_entity_1.Review).save(review);
    }
    async rejectReview(ctx, id) {
        const review = await this.connection.getEntityOrThrow(ctx, review_entity_1.Review, id);
        review.status = 'rejected';
        return this.connection.getRepository(ctx, review_entity_1.Review).save(review);
    }
    async getReview(ctx, id) {
        return this.connection.getEntityOrThrow(ctx, review_entity_1.Review, id);
    }
    async getReviews(ctx, options) {
        const where = {};
        if ((options === null || options === void 0 ? void 0 : options.productId) != null) {
            where.productId = Number(options.productId);
        }
        if ((options === null || options === void 0 ? void 0 : options.status) != null) {
            where.status = options.status;
        }
        return this.listQueryBuilder
            .build(review_entity_1.Review, options, {
            ctx,
            relations: ['channels'],
            channelId: ctx.channelId,
            where,
        })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    async getProductReviews(ctx, productId, options) {
        return this.listQueryBuilder
            .build(review_entity_1.Review, options, {
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
    async getMyReviews(ctx) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return this.connection
            .getRepository(ctx, review_entity_1.Review)
            .find({
            where: { customerId: customer.id },
            order: { createdAt: 'DESC' },
        });
    }
    async getReviewStats(ctx, productId) {
        var _a, _b, _c;
        const repo = this.connection.getRepository(ctx, review_entity_1.Review);
        const reviews = await repo.find({
            where: { productId: Number(productId), status: 'approved' },
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
        const distMap = new Map();
        for (const r of reviews) {
            distMap.set(r.rating, ((_a = distMap.get(r.rating)) !== null && _a !== void 0 ? _a : 0) + 1);
        }
        const ratingDistribution = [1, 2, 3, 4, 5].map(rating => {
            var _a;
            return ({
                rating,
                count: (_a = distMap.get(rating)) !== null && _a !== void 0 ? _a : 0,
            });
        });
        const tagMap = new Map();
        for (const r of reviews) {
            for (const tag of (_b = r.tags) !== null && _b !== void 0 ? _b : []) {
                tagMap.set(tag, ((_c = tagMap.get(tag)) !== null && _c !== void 0 ? _c : 0) + 1);
            }
        }
        const topTags = [...tagMap.entries()]
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        return { totalCount, goodRate, averageRating, ratingDistribution, topTags };
    }
    async markHelpful(ctx, id) {
        const review = await this.connection.getEntityOrThrow(ctx, review_entity_1.Review, id, {
            where: { status: 'approved' },
        });
        review.helpfulCount += 1;
        return this.connection.getRepository(ctx, review_entity_1.Review).save(review);
    }
    async getCustomerName(ctx, review) {
        if (review.isAnonymous) {
            return null;
        }
        const customer = await this.customerService.findOne(ctx, review.customerId);
        if (!customer) {
            return null;
        }
        return [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.emailAddress;
    }
};
exports.ReviewService = ReviewService;
exports.ReviewService = ReviewService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder,
        core_1.CustomerService])
], ReviewService);
//# sourceMappingURL=review.service.js.map