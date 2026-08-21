import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext } from '@vendure/core';

import { manageOwnShop } from '@vendure/shop-plugin';

import { Subscription } from './subscription.entity';
import { SubscriptionOccurrence } from './subscription-occurrence.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { SubscriptionService } from './subscription.service';
import { ListOptions, SubscriptionItem } from './types';

/** 店主自营后台（ADMIN API）：本店套餐档管理 + 逐期指定内容 + 取消订阅。归属隔离强制在 service 业务层。 */
@Resolver()
export class SubscriptionOwnerResolver {
    constructor(private service: SubscriptionService) {}

    @Query()
    @Allow(manageOwnShop.Permission)
    async myShopSubscriptionPlans(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: ListOptions,
    ): Promise<{ items: SubscriptionPlan[]; totalItems: number }> {
        return this.service.shopPlans(ctx, options);
    }

    @Mutation()
    @Allow(manageOwnShop.Permission)
    async createSubscriptionPlan(
        @Ctx() ctx: RequestContext,
        @Args('input') input: any,
    ): Promise<SubscriptionPlan> {
        return this.service.createPlan(ctx, input);
    }

    @Mutation()
    @Allow(manageOwnShop.Permission)
    async setSubscriptionOccurrenceItems(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('items') items: SubscriptionItem[],
    ): Promise<SubscriptionOccurrence> {
        return this.service.ownerSetOccurrenceItems(ctx, id, items);
    }

    @Mutation()
    @Allow(manageOwnShop.Permission)
    async cancelSubscriptionOwner(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<Subscription> {
        return this.service.cancelSubscription(ctx, id);
    }
}