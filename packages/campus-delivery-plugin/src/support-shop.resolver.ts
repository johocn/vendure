import { Args, ID as GqlID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';
import { RiderOpsService } from './rider-ops.service';
import { SupportService } from './support.service';

/** C 端：客服工单 / 骑手申诉 / 骑手评分 / 我的班次 / 配送导航 */
@Resolver()
export class SupportShopResolver {
    constructor(private support: SupportService, private riderOps: RiderOpsService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async campusMySupportTickets(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number,
    ) {
        return this.support.myTickets(ctx, skip, take);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async campusCreateSupportTicket(
        @Ctx() ctx: RequestContext,
        @Args('category') category: string,
        @Args('content') content: string,
        @Args({ name: 'images', type: () => [String], nullable: true }) images?: string[],
        @Args({ name: 'orderCode', type: () => String, nullable: true }) orderCode?: string,
    ) {
        return this.support.createTicket(ctx, { category, content, images, orderCode });
    }

    @Query()
    @Allow(Permission.Authenticated)
    async campusMyRiderAppeals(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number,
    ) {
        return this.support.myAppeals(ctx, skip, take);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async campusCreateRiderAppeal(
        @Ctx() ctx: RequestContext,
        @Args('reason') reason: string,
        @Args({ name: 'orderId', type: () => GqlID, nullable: true }) orderId?: ID,
        @Args({ name: 'images', type: () => [String], nullable: true }) images?: string[],
    ) {
        return this.support.createAppeal(ctx, { orderId, reason, images });
    }

    @Query()
    @Allow(Permission.Authenticated)
    async campusMyRiderRating(@Ctx() ctx: RequestContext) {
        return this.riderOps.ratingStats(ctx);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async campusRateRider(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('rating') rating: number,
        @Args({ name: 'tags', type: () => [String], nullable: true }) tags?: string[],
        @Args({ name: 'comment', type: () => String, nullable: true }) comment?: string,
    ) {
        const row = await this.riderOps.createReview(ctx, orderId, rating, tags, comment);
        return { ok: true, rating: row.rating };
    }

    @Query()
    @Allow(Permission.Authenticated)
    async campusMyShifts(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'from', type: () => String, nullable: true }) from?: string,
        @Args({ name: 'to', type: () => String, nullable: true }) to?: string,
    ) {
        return this.riderOps.myShifts(ctx, from, to);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async campusRiderNav(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.riderOps.riderNav(ctx, orderId);
    }
}
