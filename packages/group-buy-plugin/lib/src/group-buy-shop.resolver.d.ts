import { ID, RequestContext } from '@vendure/core';
import { GroupBuyActivity } from './group-buy-activity.entity';
import { GroupBuyOrder } from './group-buy-order.entity';
import { GroupBuyService } from './group-buy.service';
export declare class GroupBuyShopResolver {
    private groupBuyService;
    constructor(groupBuyService: GroupBuyService);
    activeGroupBuyActivities(ctx: RequestContext, variantId: ID): Promise<GroupBuyActivity[]>;
    joinGroupBuy(ctx: RequestContext, activityId: ID, orderId: ID, isLeader: boolean): Promise<GroupBuyOrder>;
}
