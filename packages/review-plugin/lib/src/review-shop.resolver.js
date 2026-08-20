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
exports.ReviewShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const review_entity_1 = require("./review.entity");
const review_service_1 = require("./review.service");
let ReviewShopResolver = class ReviewShopResolver {
    constructor(reviewService) {
        this.reviewService = reviewService;
    }
    async productReviews(ctx, productId, options) {
        return this.reviewService.getProductReviews(ctx, productId, options);
    }
    async myReviews(ctx) {
        return this.reviewService.getMyReviews(ctx);
    }
    async reviewStats(ctx, productId) {
        return this.reviewService.getReviewStats(ctx, productId);
    }
    async productRating(ctx, productId) {
        return this.reviewService.getProductRating(ctx, productId);
    }
    async createReview(ctx, input) {
        return this.reviewService.createReview(ctx, input);
    }
    async updateReview(ctx, id, input) {
        return this.reviewService.updateReview(ctx, id, input);
    }
    async deleteReview(ctx, id) {
        return this.reviewService.deleteReview(ctx, id);
    }
    async createFollowUpReview(ctx, reviewId, input) {
        return this.reviewService.createFollowUpReview(ctx, reviewId, input);
    }
    async markReviewHelpful(ctx, id) {
        return this.reviewService.markHelpful(ctx, id);
    }
    async followUps(ctx, review) {
        return this.reviewService.getReviewFollowUps(ctx, review);
    }
    async customerName(ctx, review) {
        return this.reviewService.getCustomerName(ctx, review);
    }
};
exports.ReviewShopResolver = ReviewShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __param(2, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], ReviewShopResolver.prototype, "productReviews", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], ReviewShopResolver.prototype, "myReviews", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ReviewShopResolver.prototype, "reviewStats", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ReviewShopResolver.prototype, "productRating", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ReviewShopResolver.prototype, "createReview", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], ReviewShopResolver.prototype, "updateReview", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ReviewShopResolver.prototype, "deleteReview", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('reviewId')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], ReviewShopResolver.prototype, "createFollowUpReview", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ReviewShopResolver.prototype, "markReviewHelpful", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, review_entity_1.Review]),
    __metadata("design:returntype", Promise)
], ReviewShopResolver.prototype, "followUps", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, review_entity_1.Review]),
    __metadata("design:returntype", Promise)
], ReviewShopResolver.prototype, "customerName", null);
exports.ReviewShopResolver = ReviewShopResolver = __decorate([
    (0, graphql_1.Resolver)('Review'),
    __metadata("design:paramtypes", [review_service_1.ReviewService])
], ReviewShopResolver);
//# sourceMappingURL=review-shop.resolver.js.map