import { ID, RequestContext } from '@vendure/core';
import { CommunityActivity } from './community-activity.entity';
import { CommunityLeader } from './community-leader.entity';
import { CommunityParticipation } from './community-participation.entity';
import { CommunityService } from './community.service';
export declare class CommunityAdminResolver {
    private service;
    constructor(service: CommunityService);
    approveLeader(ctx: RequestContext, id: ID): Promise<CommunityLeader>;
    suspendLeader(ctx: RequestContext, id: ID): Promise<CommunityLeader>;
    cutoverActivity(ctx: RequestContext, id: ID): Promise<CommunityActivity>;
    communityActivities(ctx: RequestContext, args: any): Promise<{
        items: CommunityActivity[];
        totalItems: number;
    }>;
    communityParticipations(ctx: RequestContext, args: any): Promise<{
        items: CommunityParticipation[];
        totalItems: number;
    }>;
}
