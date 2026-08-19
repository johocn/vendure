import { ID, Injector, RequestContext } from '@vendure/core';
import { OrderSplitPlan, OrderSplitPlanProvider } from './order-split-plan';
export declare class AutoSplitPlanService implements OrderSplitPlanProvider {
    private injector;
    private connection;
    init(injector: Injector): void;
    buildAutoPlan(ctx: RequestContext, orderId: ID): Promise<OrderSplitPlan>;
    private parseSplitDetail;
    private loadOrderWithLines;
}
