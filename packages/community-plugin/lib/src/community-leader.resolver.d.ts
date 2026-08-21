import { ID, RequestContext } from '@vendure/core';
import { CommunityActivity } from './community-activity.entity';
import { CommunityLeader } from './community-leader.entity';
import { CommunityService } from './community.service';
export declare class CommunityLeaderResolver {
    private service;
    constructor(service: CommunityService);
    myActivities(ctx: RequestContext, args: any): Promise<{
        items: CommunityActivity[];
        totalItems: number;
    }>;
    myCommission(ctx: RequestContext): Promise<{
        totalCommission: number;
    }>;
    applyLeader(ctx: RequestContext, pickupLocationId: ID): Promise<CommunityLeader>;
    createActivity(ctx: RequestContext, input: any): Promise<CommunityActivity>;
}
