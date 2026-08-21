import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { CommunityActivity } from './community-activity.entity';
import { CommunityLeader } from './community-leader.entity';
import { CommunityService } from './community.service';

@Resolver('CommunityActivity')
export class CommunityLeaderResolver {
    constructor(private service: CommunityService) {}

    @Query()
    @Allow(Permission.Owner)
    async myActivities(
        @Ctx() ctx: RequestContext,
        @Args() args: any,
    ): Promise<{ items: CommunityActivity[]; totalItems: number }> {
        return this.service.myActivities(ctx, args.options);
    }

    @Query()
    @Allow(Permission.Owner)
    async myCommission(@Ctx() ctx: RequestContext): Promise<{ totalCommission: number }> {
        return this.service.myCommission(ctx);
    }

    @Mutation()
    @Allow(Permission.Owner)
    async applyLeader(
        @Ctx() ctx: RequestContext,
        @Args('pickupLocationId') pickupLocationId: ID,
    ): Promise<CommunityLeader> {
        return this.service.applyLeader(ctx, pickupLocationId);
    }

    @Mutation()
    @Allow(Permission.Owner)
    async createActivity(
        @Ctx() ctx: RequestContext,
        @Args('input') input: any,
    ): Promise<CommunityActivity> {
        return this.service.createActivity(ctx, input);
    }
}