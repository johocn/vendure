import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';
import { AfterSalesReviewService } from './after-sales-review.service';
import { CampusPermissions } from './permissions';

/** 商家端：退款后满意度汇总与低分跟进（§93） */
@Resolver()
export class AfterSalesReviewAdminResolver {
    constructor(private reviews: AfterSalesReviewService) {}

    /** 满意度汇总（§93）：区间内均分/分档/低分待跟进 */
    @Query()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesReviewSummary(
        @Ctx() ctx: RequestContext,
        @Args('from') from: string,
        @Args('to') to: string,
    ) {
        return this.reviews.summary(ctx, from, to);
    }

    /** 标记低分已跟进（§93） */
    @Mutation()
    @Allow(CampusPermissions.CampusMerchant as any)
    async campusMerchantAfterSalesReviewFollowUp(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ) {
        return this.reviews.markFollowed(ctx, id);
    }
}

/** C 端：退款完成后邀请顾客评分（§93） */
@Resolver()
export class AfterSalesReviewShopResolver {
    constructor(private reviews: AfterSalesReviewService) {}

    @Mutation()
    @Allow(Permission.Authenticated)
    async campusSubmitAfterSalesReview(
        @Ctx() ctx: RequestContext,
        @Args('requestId') requestId: ID,
        @Args({ name: 'score', type: () => Int }) score: number,
        @Args({ name: 'comment', type: () => String, nullable: true }) comment?: string | null,
        @Args({ name: 'tags', type: () => [String], nullable: true }) tags?: string[] | null,
    ) {
        return this.reviews.submit(ctx, requestId, score, comment, tags);
    }
}
