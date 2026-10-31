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

    @Query()
    @Allow(Permission.ReadOrder)
    async reviewStats(@Ctx() ctx: RequestContext, @Args('productId') productId: ID): Promise<any> {
        return this.reviewService.getReviewStats(ctx, productId);
    }

    /** 差评申诉列表（P0-4）：status 传申诉状态，缺省列出全部有申诉的评价 */
    @Query()
    @Allow(Permission.ReadOrder)
    async reviewAppeals(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options: any): Promise<any> {
        return this.reviewService.getReviewAppeals(ctx, options);
    }

    @Query()
    @Allow(Permission.ReadOrder)
    async productRating(@Ctx() ctx: RequestContext, @Args('productId') productId: ID): Promise<any> {
        return this.reviewService.getProductRating(ctx, productId);
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

    /** 差评申诉通过：评价隐藏并退出评分聚合 */
    @Mutation()
    @Allow(Permission.UpdateOrder)
    async approveReviewAppeal(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args({ name: 'note', type: () => String, nullable: true }) note?: string,
    ): Promise<any> {
        return this.reviewService.approveReviewAppeal(ctx, id, note);
    }

    /** 差评申诉驳回：评价维持原状，仅留痕 */
    @Mutation()
    @Allow(Permission.UpdateOrder)
    async rejectReviewAppeal(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args({ name: 'note', type: () => String, nullable: true }) note?: string,
    ): Promise<any> {
        return this.reviewService.rejectReviewAppeal(ctx, id, note);
    }

    /** 撤销申诉通过：评价恢复展示并重新计入评分聚合 */
    @Mutation()
    @Allow(Permission.UpdateOrder)
    async revokeReviewAppeal(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args({ name: 'note', type: () => String, nullable: true }) note?: string,
    ): Promise<any> {
        return this.reviewService.revokeReviewAppeal(ctx, id, note);
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
