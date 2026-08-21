import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { CommunityActivity } from './community-activity.entity';
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
}