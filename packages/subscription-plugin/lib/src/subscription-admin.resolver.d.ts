import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { Subscription } from './subscription.entity';
import { SubscriptionOccurrence } from './subscription-occurrence.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { SubscriptionService } from './subscription.service';
import { ListOptions } from './types';
/** 平台管理端（ADMIN API）：全部套餐档/订阅/期次查看 + 停用套餐档。 */
export declare class SubscriptionAdminResolver {
    private service;
    private connection;
    constructor(service: SubscriptionService, connection: TransactionalConnection);
    subscriptionPlans(ctx: RequestContext, options: ListOptions): Promise<{
        items: SubscriptionPlan[];
        totalItems: number;
    }>;
    subscriptions(ctx: RequestContext, options: ListOptions): Promise<{
        items: Subscription[];
        totalItems: number;
    }>;
    subscriptionOccurrences(ctx: RequestContext, options: ListOptions): Promise<{
        items: SubscriptionOccurrence[];
        totalItems: number;
    }>;
    setSubscriptionPlanEnabled(ctx: RequestContext, id: ID, enabled: boolean): Promise<SubscriptionPlan>;
}
