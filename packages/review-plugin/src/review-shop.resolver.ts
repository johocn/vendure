import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { Review } from './review.entity';
import { ReviewService } from './review.service';

@Resolver('Review')
export class ReviewShopResolver {
    constructor(private reviewService: ReviewService) {}

    @Query()
    @Allow(Permission.Public)
    async productReviews(
        @Ctx() ctx: RequestContext,
        @Args('productId') productId: ID,
        @Args('options', { nullable: true }) options: any,
    ): Promise<any> {
        return this.reviewService.getProductReviews(ctx, productId, options);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myReviews(@Ctx() ctx: RequestContext): Promise<any> {
        return this.reviewService.getMyReviews(ctx);
    }

    @Query()
    @Allow(Permission.Public)
    async reviewStats(@Ctx() ctx: RequestContext, @Args('productId') productId: ID): Promise<any> {
        return this.reviewService.getReviewStats(ctx, productId);
    }

    @Query()
    @Allow(Permission.Public)
    async productRating(@Ctx() ctx: RequestContext, @Args('productId') productId: ID): Promise<any> {
        return this.reviewService.getProductRating(ctx, productId);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async createReview(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<any> {
        return this.reviewService.createReview(ctx, input);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async updateReview(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('input') input: any,
    ): Promise<any> {
        return this.reviewService.updateReview(ctx, id, input);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async deleteReview(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<any> {
        return this.reviewService.deleteReview(ctx, id);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async createFollowUpReview(
        @Ctx() ctx: RequestContext,
        @Args('reviewId') reviewId: ID,
        @Args('input') input: any,
    ): Promise<any> {
        return this.reviewService.createFollowUpReview(ctx, reviewId, input);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async markReviewHelpful(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<any> {
        return this.reviewService.markHelpful(ctx, id);
    }

    @ResolveField()
    async followUps(@Ctx() ctx: RequestContext, @Parent() review: Review): Promise<any> {
        return this.reviewService.getReviewFollowUps(ctx, review);
    }

    @ResolveField()
    async customerName(@Ctx() ctx: RequestContext, @Parent() review: Review): Promise<string | null> {
        return this.reviewService.getCustomerName(ctx, review);
    }
}
