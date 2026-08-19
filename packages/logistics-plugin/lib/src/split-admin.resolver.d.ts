import { RequestContext } from '@vendure/core';
import { AutoSplitPlanService } from './auto-split-plan.service';
import { ManualSplitAdjustService } from './manual-split-adjust.service';
import { OrderSplitPlan, SplitLine } from './order-split-plan';
export declare class SplitAdminResolver {
    private autoSplit;
    private manualSplit;
    constructor(autoSplit: AutoSplitPlanService, manualSplit: ManualSplitAdjustService);
    splitPlanPreview(ctx: RequestContext, orderId: string): Promise<OrderSplitPlan>;
    confirmSplitPlan(ctx: RequestContext, orderId: string, packages: Array<{
        stockLocationId: string;
        lines: SplitLine[];
    }>): Promise<OrderSplitPlan>;
}
