import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { Subscription } from './subscription.entity';
import { SubscriptionOccurrence } from './subscription-occurrence.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { SubscriptionService } from './subscription.service';
import { SubscriptionListOptions } from './types';

/** 买家自营（SHOP API）：查看可用套餐档/我的订阅/期次，买断开通与续订确认。全部 Permission.Owner，customerId 取 ctx.activeUserId。 */
@Resolver()
export class SubscriptionCustomerResolver {
    constructor(private service: SubscriptionService) {}

    @Query()
    @Allow(Permission.Owner)
    async availablePlans(
        @Ctx() ctx: RequestContext,
        @Args('shopId', { nullable: true }) shopId: ID,
        @Args('options', { nullable: true }) options: SubscriptionListOptions,
    ): Promise<{ items: SubscriptionPlan[]; totalItems: number }> {
        return this.service.allPlans(ctx, options);
    }

    @Query()
    @Allow(Permission.Owner)
    async mySubscriptions(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: SubscriptionListOptions,
    ): Promise<{ items: Subscription[]; totalItems: number }> {
        return this.service.customerSubscriptions(ctx, ctx.activeUserId as number, options);
    }

    @Query()
    @Allow(Permission.Owner)
    async mySubscriptionOccurrences(
        @Ctx() ctx: RequestContext,
        @Args('subscriptionId') subscriptionId: ID,
        @Args('options', { nullable: true }) options: SubscriptionListOptions,
    ): Promise<{ items: SubscriptionOccurrence[]; totalItems: number }> {
        return this.service.occurrencesOf(ctx, subscriptionId, options);
    }

    @Mutation()
    @Allow(Permission.Owner)
    async createSubscription(
        @Ctx() ctx: RequestContext,
        @Args('planId') planId: ID,
        @Args('input') input: { startDate: string },
    ): Promise<Subscription> {
        return this.service.createSubscription(ctx, ctx.activeUserId as number, planId, input.startDate);
    }

    @Mutation()
    @Allow(Permission.Owner)
    async confirmRenewal(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<Subscription> {
        return this.service.initiateRenewal(ctx, id);
    }
}