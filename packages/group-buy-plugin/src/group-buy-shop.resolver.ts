import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, RequestContext } from '@vendure/core';

import { GroupBuyActivity } from './group-buy-activity.entity';
import { GroupBuyOrder } from './group-buy-order.entity';
import { GroupBuyService } from './group-buy.service';

@Resolver()
export class GroupBuyShopResolver {
    constructor(private groupBuyService: GroupBuyService) {}

    @Query()
    async activeGroupBuyActivities(
        @Ctx() ctx: RequestContext,
        @Args('variantId') variantId: ID,
    ): Promise<GroupBuyActivity[]> {
        return this.groupBuyService.findActiveByVariant(ctx, variantId);
    }

    @Mutation()
    async joinGroupBuy(
        @Ctx() ctx: RequestContext,
        @Args('activityId') activityId: ID,
        @Args('orderId') orderId: ID,
        @Args('isLeader') isLeader: boolean,
    ): Promise<GroupBuyOrder> {
        return this.groupBuyService.joinGroupBuy(ctx, activityId, orderId, isLeader);
    }
}
