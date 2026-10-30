import { Args, ID as GqlID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext } from '@vendure/core';
import { CampusPermissions } from './permissions';
import { RiderOpsService } from './rider-ops.service';
import { SupportService } from './support.service';

/** 运营侧：客服工单 / 骑手申诉 / 黑名单 / 排班 / 在线时长 / 评分查询 */
@Resolver()
export class SupportAdminResolver {
    constructor(private support: SupportService, private riderOps: RiderOpsService) {}

    @Query()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusSupportTickets(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'status', type: () => String, nullable: true }) status?: string,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number,
    ) {
        return this.support.adminTickets(ctx, status, skip, take);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusReplySupportTicket(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args({ name: 'reply', type: () => String, nullable: true }) reply?: string,
        @Args({ name: 'status', type: () => String, nullable: true }) status?: string,
    ) {
        return this.support.replyTicket(ctx, id, reply, status);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusLinkSupportTicketAfterSales(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args({ name: 'afterSalesRequestId', type: () => GqlID }) afterSalesRequestId: ID,
    ) {
        return this.support.linkTicketAfterSales(ctx, id, afterSalesRequestId);
    }

    @Query()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusRiderAppeals(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'status', type: () => String, nullable: true }) status?: string,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number,
    ) {
        return this.support.adminAppeals(ctx, status, skip, take);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusReviewRiderAppeal(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('approve') approve: boolean,
        @Args({ name: 'creditDelta', type: () => Number, nullable: true }) creditDelta?: number,
        @Args({ name: 'note', type: () => String, nullable: true }) note?: string,
    ) {
        return this.support.reviewAppeal(ctx, id, approve, creditDelta, note);
    }

    @Query()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusBlacklist(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number,
    ) {
        return this.support.listBlacklist(ctx, skip, take);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusAddBlacklist(
        @Ctx() ctx: RequestContext,
        @Args('type') type: string,
        @Args('value') value: string,
        @Args({ name: 'reason', type: () => String, nullable: true }) reason?: string,
    ) {
        return this.support.addBlacklist(ctx, { type, value, reason });
    }

    @Mutation()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusImportBlacklist(
        @Ctx() ctx: RequestContext,
        @Args('type') type: string,
        @Args({ name: 'values', type: () => [String] }) values: string[],
        @Args({ name: 'reason', type: () => String, nullable: true }) reason?: string,
    ) {
        return this.support.importBlacklist(ctx, type, values, reason);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusRemoveBlacklist(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.support.removeBlacklist(ctx, id);
    }

    @Query()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusRiderShifts(@Ctx() ctx: RequestContext, @Args('date') date: string) {
        return this.riderOps.listShifts(ctx, date);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusSaveRiderShift(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.riderOps.saveShift(ctx, input);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusDeleteRiderShift(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.riderOps.deleteShift(ctx, id);
    }

    @Query()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusRiderOnlineStats(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'date', type: () => String, nullable: true }) date?: string,
    ) {
        return this.riderOps.onlineStats(ctx, date);
    }

    @Query()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusRiderReviews(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'riderCustomerId', type: () => GqlID, nullable: true }) riderCustomerId?: ID,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number,
    ) {
        return this.riderOps.adminReviews(ctx, riderCustomerId, skip, take);
    }

    @Query()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusRiderRating(@Ctx() ctx: RequestContext, @Args('riderCustomerId') riderCustomerId: ID) {
        return this.riderOps.ratingStats(ctx, riderCustomerId);
    }
}
