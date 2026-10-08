import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { JianghuService } from './jianghu.service';
import { RANK_LADDER } from './constants';

@Resolver()
export class JianghuShopResolver {
    constructor(private service: JianghuService) {}

    @Query()
    @Allow(Permission.Authenticated)
    jianghuProfile(@Ctx() ctx: RequestContext) {
        return this.service.myProfile(ctx);
    }

    @Query()
    @Allow(Permission.Authenticated)
    jianghuRankLadder() {
        return RANK_LADDER;
    }

    @Query()
    @Allow(Permission.Authenticated)
    jianghuHall(
        @Ctx() ctx: RequestContext,
        @Args() args: { type?: string; campusCode?: string; cursor?: string; limit?: number; lat?: number; lng?: number },
    ) {
        return this.service.hall(ctx, args.type, args.campusCode, args.cursor, args.limit, args.lat, args.lng);
    }

    @Query()
    @Allow(Permission.Authenticated)
    jianghuTaskDetail(@Ctx() ctx: RequestContext, @Args() args: { taskId: string }) {
        return this.service.taskDetail(ctx, args.taskId);
    }

    @Query()
    @Allow(Permission.Authenticated)
    jianghuMyRecords(@Ctx() ctx: RequestContext, @Args() args: { cursor?: string; limit?: number }) {
        return this.service.myRecords(ctx, args.cursor, args.limit);
    }

    @Query()
    @Allow(Permission.Authenticated)
    jianghuDailyRank(@Ctx() ctx: RequestContext, @Args() args: { campusCode?: string }) {
        return this.service.dailyRank(ctx, args.campusCode);
    }

    @Query()
    @Allow(Permission.Authenticated)
    jianghuIntelMarket(
        @Ctx() ctx: RequestContext,
        @Args() args: { campusCode?: string; cursor?: string; limit?: number },
    ) {
        return this.service.intelMarket(ctx, args.campusCode, args.cursor, args.limit);
    }

    @Query()
    @Allow(Permission.Authenticated)
    jianghuEventCurrent(@Ctx() ctx: RequestContext, @Args() args: { campusCode?: string }) {
        return this.service.eventCurrent(ctx, args.campusCode);
    }

    @Query()
    @Allow(Permission.Authenticated)
    jianghuEventDetail(@Ctx() ctx: RequestContext) {
        return this.service.eventDetail(ctx);
    }

    @Query()
    @Allow(Permission.Authenticated)
    jianghuEventContent(@Ctx() ctx: RequestContext) {
        return this.service.getEventContent(ctx);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    jianghuTakeTask(@Ctx() ctx: RequestContext, @Args() args: { taskId: string }) {
        return this.service.take(ctx, args.taskId);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    jianghuReleaseTask(@Ctx() ctx: RequestContext, @Args() args: { taskId: string }) {
        return this.service.release(ctx, args.taskId);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    jianghuRefreshCode(@Ctx() ctx: RequestContext, @Args() args: { taskId: string }) {
        return this.service.refreshCode(ctx, args.taskId);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    jianghuVerify(
        @Ctx() ctx: RequestContext,
        @Args() args: { taskId: string; code?: string; lat?: number; lng?: number },
    ) {
        return this.service.verify(ctx, args.taskId, args.code, args.lat, args.lng);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    jianghuSubmitRumor(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: { category: any; content: string; sourceNote: string } },
    ) {
        return this.service.submitRumor(ctx, args.input);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    jianghuUnlockIntel(@Ctx() ctx: RequestContext, @Args() args: { intelId: string }) {
        return this.service.unlockIntel(ctx, args.intelId);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    jianghuCollectClue(@Ctx() ctx: RequestContext, @Args() args: { input: { content: string; sourceNote: string } }) {
        return this.service.collectClue(ctx, args.input);
    }
}
