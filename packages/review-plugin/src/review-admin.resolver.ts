import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { Review } from './review.entity';
import { ReviewService } from './review.service';

@Resolver('Review')
export class ReviewAdminResolver {
    constructor(private reviewService: ReviewService) {}

    @Query()
    @Allow(Permission.ReadOrder)
    async reviews(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options: any): Promise<any> {
        return this.reviewService.getReviews(ctx, options);
    }

    @Query()
    @Allow(Permission.ReadOrder)
    async review(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<any> {
        return this.reviewService.getReview(ctx, id);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async replyReview(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('reply') reply: string,
    ): Promise<any> {
        return this.reviewService.replyReview(ctx, id, reply);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async approveReview(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<any> {
        return this.reviewService.approveReview(ctx, id);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async rejectReview(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<any> {
        return this.reviewService.rejectReview(ctx, id);
    }

    @ResolveField()
    async customerName(@Ctx() ctx: RequestContext, @Parent() review: Review): Promise<string | null> {
        return this.reviewService.getCustomerName(ctx, review);
    }
}
