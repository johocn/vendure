import { ID, RequestContext } from '@vendure/core';
import { CommunityActivity } from './community-activity.entity';
import { CommunityCommissionEntry } from './community-commission-entry.entity';
import { CommunityLeader } from './community-leader.entity';
import { CommunityParticipation } from './community-participation.entity';
import { CommunityService } from './community.service';
export declare class CommunityAdminResolver {
    private service;
    constructor(service: CommunityService);
    approveLeader(ctx: RequestContext, id: ID): Promise<CommunityLeader>;
    suspendLeader(ctx: RequestContext, id: ID): Promise<CommunityLeader>;
    setActivityStatus(ctx: RequestContext, id: ID, status: string): Promise<CommunityActivity>;
    participate(ctx: RequestContext, orderId: ID, activityId: ID, subtotal: number): Promise<CommunityParticipation>;
    cutoverActivity(ctx: RequestContext, id: ID): Promise<CommunityActivity>;
    communityActivities(ctx: RequestContext, args: any): Promise<{
        items: CommunityActivity[];
        totalItems: number;
    }>;
    communityParticipations(ctx: RequestContext, args: any): Promise<{
        items: CommunityParticipation[];
        totalItems: number;
    }>;
    communityCommissionEntries(ctx: RequestContext, args: any): Promise<{
        items: CommunityCommissionEntry[];
        totalItems: number;
    }>;
}
