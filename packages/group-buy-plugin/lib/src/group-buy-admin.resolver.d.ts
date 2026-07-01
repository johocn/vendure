import { ID, ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { GroupBuyActivity } from './group-buy-activity.entity';
import { GroupBuyService } from './group-buy.service';
export declare class GroupBuyAdminResolver {
    private groupBuyService;
    constructor(groupBuyService: GroupBuyService);
    groupBuyActivities(ctx: RequestContext, options: ListQueryOptions<GroupBuyActivity>): Promise<PaginatedList<GroupBuyActivity>>;
    groupBuyActivity(ctx: RequestContext, id: ID): Promise<GroupBuyActivity | undefined>;
    createGroupBuyActivity(ctx: RequestContext, input: any): Promise<GroupBuyActivity>;
    updateGroupBuyActivity(ctx: RequestContext, input: any): Promise<GroupBuyActivity>;
    deleteGroupBuyActivity(ctx: RequestContext, id: ID): Promise<boolean>;
}
