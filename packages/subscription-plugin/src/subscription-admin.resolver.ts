import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, TransactionalConnection } from '@vendure/core';

import { Subscription } from './subscription.entity';
import { SubscriptionOccurrence } from './subscription-occurrence.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { SubscriptionService } from './subscription.service';
import { SubscriptionListOptions } from './types';

/** 平台管理端（ADMIN API）：全部套餐档/订阅/期次查看 + 停用套餐档。 */
@Resolver()
export class SubscriptionAdminResolver {
    constructor(
        private service: SubscriptionService,
        private connection: TransactionalConnection,
    ) {}

    @Query()
    @Allow(Permission.UpdateSettings)
    async subscriptionPlans(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: SubscriptionListOptions,
    ): Promise<{ items: SubscriptionPlan[]; totalItems: number }> {
        return this.service.allPlans(ctx, options);
    }

    @Query()
    @Allow(Permission.UpdateSettings)
    async subscriptions(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: SubscriptionListOptions,
    ): Promise<{ items: Subscription[]; totalItems: number }> {
        return this.service.allSubscriptions(ctx, options);
    }

    @Query()
    @Allow(Permission.UpdateSettings)
    async subscriptionOccurrences(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: SubscriptionListOptions,
    ): Promise<{ items: SubscriptionOccurrence[]; totalItems: number }> {
        return this.service.allOccurrences(ctx, options);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async setSubscriptionPlanEnabled(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('enabled') enabled: boolean,
    ): Promise<SubscriptionPlan> {
        const repo = this.connection.getRepository(ctx, SubscriptionPlan);
        const plan = await repo.findOne({ where: { id: Number(id) } as any });
        if (!plan) {
            throw new Error('Plan not found');
        }
        plan.enabled = enabled;
        return repo.save(plan);
    }

    /** 调试/平台调度入口：扫描所有到期期次生成订单。asOf 缺省为当前时间。 */
    @Mutation()
    @Allow(Permission.UpdateSettings)
    async processDueSubscriptions(@Ctx() ctx: RequestContext): Promise<{ created: number; skipped: number }> {
        return this.service.processDueOccurrences(ctx);
    }
}