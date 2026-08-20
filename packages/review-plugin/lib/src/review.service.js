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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const review_entity_1 = require("./review.entity");
const typeorm_1 = require("typeorm");
const ALLOWED_ORDER_STATES = ['Delivered', 'Completed'];
/** 对外可见且计入评分聚合的状态。 */
const VISIBLE_STATUS = 'approved';
const DELETED_STATUS = 'deleted';
let ReviewService = class ReviewService {
    constructor(options = {}, connection, listQueryBuilder, customerService, productService) {
        this.options = options;
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.customerService = customerService;
        this.productService = productService;
    }
    async createReview(ctx, input) {
        var _a, _b, _c, _d;
        const customer = await this.requireCustomer(ctx);
        if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
            throw new core_1.UserInputError('rating must be an integer between 1 and 5');
        }
        this.assertContent(input.content);
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
        const status = this.options.autoApprove ? VISIBLE_STATUS : 'pending';
        const review = new review_entity_1.Review({
            customerId: customer.id,
            productId: Number(input.productId),
            orderLineId: Number(input.orderLineId),
            variantId: input.variantId ? Number(input.variantId) : null,
            rating: input.rating,
            content: input.content.trim(),
            images: (_a = input.images) !== null && _a !== void 0 ? _a : null,
            videos: (_b = input.videos) !== null && _b !== void 0 ? _b : null,
            tags: (_c = input.tags) !== null && _c !== void 0 ? _c : null,
            isAnonymous: (_d = input.isAnonymous) !== null && _d !== void 0 ? _d : false,
            status,
            channelId: ctx.channelId,
        });
        review.channels = [ctx.channel];
        const saved = await reviewRepo.save(review);
        if (status === VISIBLE_STATUS) {
            await this.recomputeProductRating(ctx, Number(input.productId));
        }
        core_1.Logger.info(`Review created by customer ${customer.id} for product ${input.productId}`, constants_1.loggerCtx);
        return saved;
    }
    /** 追评：挂在本人主评（parentId）下，聚合不计入。 */
    async createFollowUpReview(ctx, reviewId, input) {
        var _a, _b, _c, _d, _e, _f;
        const customer = await this.requireCustomer(ctx);
        const reviewRepo = this.connection.getRepository(ctx, review_entity_1.Review);
        const parent = await reviewRepo.findOne({ where: { id: Number(reviewId) } });
        if (!parent) {
            throw new core_1.EntityNotFoundError('Review', reviewId);
        }
        if (parent.customerId !== customer.id) {
            throw new core_1.ForbiddenError();
        }
        if (parent.status === DELETED_STATUS) {
            throw new core_1.UserInputError('Cannot add a follow-up to a deleted review');
        }
        if (parent.parentId != null) {
            throw new core_1.UserInputError('Cannot add a follow-up to a follow-up');
        }
        if (input.content != null) {
            this.assertContent(input.content);
        }
        if (input.rating != null && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)) {
            throw new core_1.UserInputError('rating must be an integer between 1 and 5');
        }
        const followUp = new review_entity_1.Review({
            customerId: customer.id,
            productId: parent.productId,
            orderLineId: parent.orderLineId,
            variantId: parent.variantId,
            rating: (_a = input.rating) !== null && _a !== void 0 ? _a : parent.rating,
            content: ((_b = input.content) !== null && _b !== void 0 ? _b : '').trim(),
            images: (_c = input.images) !== null && _c !== void 0 ? _c : null,
            videos: (_d = input.videos) !== null && _d !== void 0 ? _d : null,
            tags: (_e = input.tags) !== null && _e !== void 0 ? _e : null,
            isAnonymous: (_f = input.isAnonymous) !== null && _f !== void 0 ? _f : parent.isAnonymous,
            status: this.options.autoApprove ? VISIBLE_STATUS : 'pending',
            parentId: parent.id,
            channelId: ctx.channelId,
        });
        followUp.channels = [ctx.channel];
        return reviewRepo.save(followUp);
    }
    /** 修改本人评价：仅 pending/approved 可改；变更涉及已审核主评时重算评分聚合。 */
    async updateReview(ctx, id, input) {
        const customer = await this.requireCustomer(ctx);
        const review = await this.connection.getEntityOrThrow(ctx, review_entity_1.Review, id);
        if (review.customerId !== customer.id) {
            throw new core_1.ForbiddenError();
        }
        if (review.status !== 'pending' && review.status !== VISIBLE_STATUS) {
            throw new core_1.UserInputError('Only pending or approved reviews can be updated');
        }
        if (input.content != null) {
            this.assertContent(input.content);
            review.content = input.content.trim();
        }
        if (input.rating != null) {
            if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
                throw new core_1.UserInputError('rating must be an integer between 1 and 5');
            }
            // 追评无独立评分聚合，改评风仅主评生效
            if (!review.parentId) {
                review.rating = input.rating;
            }
        }
        if (input.images !== undefined)
            review.images = input.images;
        if (input.videos !== undefined)
            review.videos = input.videos;
        if (input.tags !== undefined)
            review.tags = input.tags;
        if (input.isAnonymous !== undefined)
            review.isAnonymous = input.isAnonymous;
        const wasApprovedRoot = review.status === VISIBLE_STATUS && !review.parentId;
        const saved = await this.connection.getRepository(ctx, review_entity_1.Review).save(review);
        if (wasApprovedRoot) {
            await this.recomputeProductRating(ctx, saved.productId);
        }
        return saved;
    }
    /** 删除本人评价（软删）。已审核主评删除后剔除聚合。 */
    async deleteReview(ctx, id) {
        const customer = await this.requireCustomer(ctx);
        const review = await this.connection.getEntityOrThrow(ctx, review_entity_1.Review, id);
        if (review.customerId !== customer.id) {
            throw new core_1.ForbiddenError();
        }
        if (review.status === DELETED_STATUS) {
            return true;
        }
        const wasApprovedRoot = review.status === VISIBLE_STATUS && !review.parentId;
        review.status = DELETED_STATUS;
        const saved = await this.connection.getRepository(ctx, review_entity_1.Review).save(review);
        if (wasApprovedRoot) {
            await this.recomputeProductRating(ctx, saved.productId);
        }
        return true;
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
        review.status = VISIBLE_STATUS;
        const saved = await this.connection.getRepository(ctx, review_entity_1.Review).save(review);
        if (!review.parentId) {
            await this.recomputeProductRating(ctx, saved.productId);
        }
        return saved;
    }
    async rejectReview(ctx, id) {
        const review = await this.connection.getEntityOrThrow(ctx, review_entity_1.Review, id);
        const wasApprovedRoot = review.status === VISIBLE_STATUS && !review.parentId;
        review.status = 'rejected';
        const saved = await this.connection.getRepository(ctx, review_entity_1.Review).save(review);
        if (wasApprovedRoot) {
            await this.recomputeProductRating(ctx, saved.productId);
        }
        return saved;
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
    /** C 端商品列表：仅对外可见（approved）的主评 + 追评（followUps 由 ResolveField 加载）。 */
    async getProductReviews(ctx, productId, options) {
        return this.listQueryBuilder
            .build(review_entity_1.Review, Object.assign({}, options), {
            ctx,
            relations: ['channels'],
            channelId: ctx.channelId,
            where: {
                productId: Number(productId),
                status: VISIBLE_STATUS,
                parentId: (0, typeorm_1.IsNull)(),
            },
        })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    async getMyReviews(ctx) {
        const customer = await this.requireCustomer(ctx);
        return this.connection
            .getRepository(ctx, review_entity_1.Review)
            .find({
            where: { customerId: customer.id },
            order: { createdAt: 'DESC' },
        });
    }
    async getReviewFollowUps(ctx, review) {
        return this.connection
            .getRepository(ctx, review_entity_1.Review)
            .find({
            where: { parentId: review.id, status: VISIBLE_STATUS },
            order: { createdAt: 'ASC' },
        });
    }
    async getReviewStats(ctx, productId) {
        var _a, _b, _c;
        const repo = this.connection.getRepository(ctx, review_entity_1.Review);
        const reviews = await repo.find({
            where: { productId: Number(productId), status: VISIBLE_STATUS, parentId: (0, typeorm_1.IsNull)() },
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
        const review = await this.connection.getEntityOrThrow(ctx, review_entity_1.Review, id);
        review.helpfulCount += 1;
        return this.connection.getRepository(ctx, review_entity_1.Review).save(review);
    }
    /** 读取聚合到 Product 自定义字段的评分快照（供列表卡片直接展示，避免全表扫描）。 */
    async getProductRating(ctx, productId) {
        var _a, _b, _c;
        const product = await this.productService.findOne(ctx, productId);
        if (!product) {
            throw new core_1.EntityNotFoundError('Product', productId);
        }
        const cf = ((_a = product.customFields) !== null && _a !== void 0 ? _a : {});
        return {
            rating: (_b = cf.reviewRating) !== null && _b !== void 0 ? _b : 0,
            reviewCount: (_c = cf.reviewCount) !== null && _c !== void 0 ? _c : 0,
        };
    }
    /** 重算商品评风聚合（approved 主评）并写回 Product.customFields。 */
    async recomputeProductRating(ctx, productId) {
        var _a, _b;
        const reviews = await this.connection.getRepository(ctx, review_entity_1.Review).find({
            where: { productId, status: VISIBLE_STATUS, parentId: (0, typeorm_1.IsNull)() },
        });
        const reviewCount = reviews.length;
        const rating = reviewCount === 0
            ? 0
            : Math.round((reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount) * 10) / 10;
        const product = await this.productService.findOne(ctx, productId);
        if (!product)
            return;
        try {
            await this.productService.update(ctx, {
                id: productId,
                customFields: Object.assign(Object.assign({}, ((_a = product.customFields) !== null && _a !== void 0 ? _a : {})), { reviewRating: rating, reviewCount }),
            });
        }
        catch (e) {
            core_1.Logger.error(`Failed to recompute rating for product ${productId}: ${(_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e}`, constants_1.loggerCtx);
        }
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
    assertContent(content) {
        var _a;
        if (content == null || !content.trim()) {
            throw new core_1.UserInputError('content must not be empty');
        }
        const minLength = (_a = this.options.minContentLength) !== null && _a !== void 0 ? _a : 0;
        if (minLength > 0 && content.trim().length < minLength) {
            throw new core_1.UserInputError(`content must be at least ${minLength} characters`);
        }
    }
    async requireCustomer(ctx) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return customer;
    }
};
exports.ReviewService = ReviewService;
exports.ReviewService = ReviewService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, common_1.Inject)(constants_1.REVIEW_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.TransactionalConnection,
        core_1.ListQueryBuilder,
        core_1.CustomerService,
        core_1.ProductService])
], ReviewService);
//# sourceMappingURL=review.service.js.map