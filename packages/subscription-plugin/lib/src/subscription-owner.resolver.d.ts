import { ID, RequestContext } from '@vendure/core';
import { Subscription } from './subscription.entity';
import { SubscriptionOccurrence } from './subscription-occurrence.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { SubscriptionService } from './subscription.service';
import { ListOptions, SubscriptionItem } from './types';
/** 店主自营后台（ADMIN API）：本店套餐档管理 + 逐期指定内容 + 取消订阅。归属隔离强制在 service 业务层。 */
export declare class SubscriptionOwnerResolver {
    private service;
    constructor(service: SubscriptionService);
    myShopSubscriptionPlans(ctx: RequestContext, options: ListOptions): Promise<{
        items: SubscriptionPlan[];
        totalItems: number;
    }>;
    createSubscriptionPlan(ctx: RequestContext, input: any): Promise<SubscriptionPlan>;
    setSubscriptionOccurrenceItems(ctx: RequestContext, id: ID, items: SubscriptionItem[]): Promise<SubscriptionOccurrence>;
    cancelSubscriptionOwner(ctx: RequestContext, id: ID): Promise<Subscription>;
}
