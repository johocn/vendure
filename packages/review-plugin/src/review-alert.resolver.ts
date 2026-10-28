import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { ReviewAlert } from './review-alert.entity';
import { ReviewAlertService } from './review-alert.service';

/** P4-2 评价品质闭环：预警规则读写 + 预警列表/详情/回评/补券/关闭。 */
@Resolver('ReviewAlert')
export class ReviewAlertResolver {
    constructor(private alertService: ReviewAlertService) {}

    @Query()
    @Allow(Permission.ReadOrder)
    async reviewAlertRule(@Ctx() ctx: RequestContext): Promise<any> {
        return this.alertService.getRule(ctx);
    }

    @Query()
    @Allow(Permission.ReadOrder)
    async reviewAlerts(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: any,
    ): Promise<any> {
        return this.alertService.getAlerts(ctx, options);
    }

    @Query()
    @Allow(Permission.ReadOrder)
    async reviewAlert(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<any> {
        return this.alertService.getAlert(ctx, id);
    }

    @Query()
    @Allow(Permission.ReadOrder)
    async reviewAlertStats(@Ctx() ctx: RequestContext): Promise<any> {
        return this.alertService.getStats(ctx);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async updateReviewAlertRule(
        @Ctx() ctx: RequestContext,
        @Args('input') input: any,
    ): Promise<any> {
        return this.alertService.updateRule(ctx, input ?? {});
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async replyReviewAlert(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('reply') reply: string,
    ): Promise<any> {
        return this.alertService.replyAlert(ctx, id, reply);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async resendReviewAlertCoupon(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<any> {
        return this.alertService.resendCoupon(ctx, id);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async closeReviewAlert(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args({ name: 'note', type: () => String, nullable: true }) note?: string,
    ): Promise<any> {
        return this.alertService.closeAlert(ctx, id, note);
    }

    @ResolveField()
    async productName(@Ctx() ctx: RequestContext, @Parent() alert: ReviewAlert): Promise<string | null> {
        return this.alertService.getProductName(ctx, alert);
    }
}
