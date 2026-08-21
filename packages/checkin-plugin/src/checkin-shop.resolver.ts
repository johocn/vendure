import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, Transaction } from '@vendure/core';

import { CheckinService } from './checkin.service';
import { CheckinTodayInfo, CreditResult, TaskSummary } from './types';

@Resolver()
export class CheckinShopResolver {
    constructor(private checkinService: CheckinService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async checkinToday(@Ctx() ctx: RequestContext): Promise<CheckinTodayInfo> {
        return this.checkinService.checkinToday(ctx);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myTasks(@Ctx() ctx: RequestContext): Promise<TaskSummary[]> {
        return this.checkinService.myTasks(ctx);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async checkin(@Ctx() ctx: RequestContext): Promise<CreditResult> {
        return this.checkinService.checkin(ctx);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async claimTask(@Ctx() ctx: RequestContext, @Args('taskCode') taskCode: string): Promise<CreditResult> {
        return this.checkinService.claimTask(ctx, taskCode);
    }
}