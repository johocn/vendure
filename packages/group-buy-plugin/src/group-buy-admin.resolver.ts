import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, ListQueryOptions, PaginatedList, RequestContext, Transaction } from '@vendure/core';

import { GroupBuyActivity } from './group-buy-activity.entity';
import { GroupBuyService } from './group-buy.service';

@Resolver()
export class GroupBuyAdminResolver {
    constructor(private groupBuyService: GroupBuyService) {}

    @Query()
    async groupBuyActivities(
        @Ctx() ctx: RequestContext,
        @Args() options: ListQueryOptions<GroupBuyActivity>,
    ): Promise<PaginatedList<GroupBuyActivity>> {
        return this.groupBuyService.findAll(ctx, options);
    }

    @Query()
    async groupBuyActivity(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<GroupBuyActivity | undefined> {
        return this.groupBuyService.findOne(ctx, id);
    }

    @Mutation()
    @Transaction()
    async createGroupBuyActivity(
        @Ctx() ctx: RequestContext,
        @Args('input') input: any,
    ): Promise<GroupBuyActivity> {
        return this.groupBuyService.create(ctx, input);
    }

    @Mutation()
    @Transaction()
    async updateGroupBuyActivity(
        @Ctx() ctx: RequestContext,
        @Args('input') input: any,
    ): Promise<GroupBuyActivity> {
        return this.groupBuyService.update(ctx, input);
    }

    @Mutation()
    @Transaction()
    async deleteGroupBuyActivity(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<boolean> {
        await this.groupBuyService.delete(ctx, id);
        return true;
    }
}
