import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { CommunityActivity } from './community-activity.entity';
import { CommunityCommissionEntry } from './community-commission-entry.entity';
import { CommunityLeader } from './community-leader.entity';
import { CommunityParticipation } from './community-participation.entity';
import { CommunityService } from './community.service';

@Resolver('CommunityActivity')
export class CommunityAdminResolver {
    constructor(private service: CommunityService) {}

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async approveLeader(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<CommunityLeader> {
        return this.service.setLeaderStatus(ctx, id, 'active');
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async suspendLeader(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<CommunityLeader> {
        return this.service.setLeaderStatus(ctx, id, 'suspended');
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async setActivityStatus(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('status') status: string,
    ): Promise<CommunityActivity> {
        return this.service.setActivityStatus(ctx, id, status as any);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async participate(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('activityId') activityId: ID,
        @Args('subtotal') subtotal: number,
    ): Promise<CommunityParticipation> {
        return this.service.participate(ctx, orderId, activityId, subtotal);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async cutoverActivity(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<CommunityActivity> {
        return this.service.cutoverActivity(ctx, id);
    }

    @Query()
    @Allow(Permission.UpdateSettings)
    async communityActivities(
        @Ctx() ctx: RequestContext,
        @Args() args: any,
    ): Promise<{ items: CommunityActivity[]; totalItems: number }> {
        return this.service.activities(ctx, args.options);
    }

    @Query()
    @Allow(Permission.UpdateSettings)
    async communityParticipations(
        @Ctx() ctx: RequestContext,
        @Args() args: any,
    ): Promise<{ items: CommunityParticipation[]; totalItems: number }> {
        return this.service.participations(ctx, args.options);
    }

    @Query()
    @Allow(Permission.UpdateSettings)
    async communityCommissionEntries(
        @Ctx() ctx: RequestContext,
        @Args() args: any,
    ): Promise<{ items: CommunityCommissionEntry[]; totalItems: number }> {
        return this.service.commissionEntries(ctx, args.options);
    }
}