import { ID, RequestContext } from '@vendure/core';
import { Subscription } from './subscription.entity';
import { SubscriptionOccurrence } from './subscription-occurrence.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { SubscriptionService } from './subscription.service';
import { ListOptions } from './types';
/** 买家自营（SHOP API）：查看可用套餐档/我的订阅/期次，买断开通与续订确认。全部 Permission.Owner，customerId 取 ctx.activeUserId。 */
export declare class SubscriptionCustomerResolver {
    private service;
    constructor(service: SubscriptionService);
    availablePlans(ctx: RequestContext, shopId: ID, options: ListOptions): Promise<{
        items: SubscriptionPlan[];
        totalItems: number;
    }>;
    mySubscriptions(ctx: RequestContext, options: ListOptions): Promise<{
        items: Subscription[];
        totalItems: number;
    }>;
    mySubscriptionOccurrences(ctx: RequestContext, subscriptionId: ID, options: ListOptions): Promise<{
        items: SubscriptionOccurrence[];
        totalItems: number;
    }>;
    createSubscription(ctx: RequestContext, planId: ID, input: {
        startDate: string;
    }): Promise<Subscription>;
    confirmRenewal(ctx: RequestContext, id: ID): Promise<Subscription>;
}
