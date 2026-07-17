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

    @Mutation()
    @Allow(Permission.Authenticated)
    async createReview(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<any> {
        return this.reviewService.createReview(ctx, input);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async markReviewHelpful(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<any> {
        return this.reviewService.markHelpful(ctx, id);
    }

    @ResolveField()
    async customerName(@Ctx() ctx: RequestContext, @Parent() review: Review): Promise<string | null> {
        return this.reviewService.getCustomerName(ctx, review);
    }
}
